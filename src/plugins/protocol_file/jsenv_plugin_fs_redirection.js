import { readEntryStatSync } from "@jsenv/filesystem";
import {
  applyFileSystemMagicResolution,
  getExtensionsToTry,
} from "@jsenv/node-esm-resolution";
import { urlIsOrIsInsideOf, urlToExtension, urlToFilename } from "@jsenv/urls";
import { existsSync, realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const jsenvPluginFsRedirection = ({
  spa,
  directoryContentMagicName,
  magicExtensions = ["inherit", ".js"],
  magicDirectoryIndex = true,
  preserveSymlinks = false,
}) => {
  return {
    name: "jsenv:fs_redirection",
    appliesDuring: "*",
    redirectReference: (reference) => {
      if (reference.url === "file:///") {
        return `ignore:file:///`;
      }
      if (reference.url === "file://") {
        return `ignore:file://`;
      }
      // ignore all new URL second arg
      if (reference.subtype === "new_url_second_arg") {
        if (reference.original) {
          return `ignore:${reference.original.specifier}`;
        }
        return `ignore:${reference.specifier}`;
      }
      // http, https, data, about, ...
      if (!reference.url.startsWith("file:")) {
        return null;
      }
      if (reference.original && !reference.original.url.startsWith("file:")) {
        return null;
      }
      if (reference.isInline) {
        return null;
      }

      if (
        reference.specifierPathname.endsWith(`/${directoryContentMagicName}`)
      ) {
        const { rootDirectoryUrl } = reference.ownerUrlInfo.context;
        const directoryUrl = new URL(
          reference.specifierPathname
            .replace(`/${directoryContentMagicName}`, "/")
            .slice(1),
          rootDirectoryUrl,
        ).href;
        return directoryUrl;
      }
      // ignore "./" on new URL("./")
      // if (
      //   reference.subtype === "new_url_first_arg" &&
      //   reference.specifier === "./"
      // ) {
      //   return `ignore:${reference.url}`;
      // }
      const urlObject = new URL(reference.url);
      let fsStat = readEntryStatSync(urlObject, { nullIfNotFound: true });
      reference.fsStat = fsStat;
      const { search, hash } = urlObject;
      urlObject.search = "";
      urlObject.hash = "";
      applyFsStatEffectsOnUrlObject(urlObject, fsStat);
      const shouldApplyFilesystemMagicResolution =
        reference.type === "js_import";
      if (shouldApplyFilesystemMagicResolution) {
        const filesystemResolution = applyFileSystemMagicResolution(
          urlObject.href,
          {
            fileStat: fsStat,
            magicDirectoryIndex,
            magicExtensions: getExtensionsToTry(
              magicExtensions,
              reference.ownerUrlInfo.url,
            ),
          },
        );
        if (filesystemResolution.stat) {
          fsStat = filesystemResolution.stat;
          reference.fsStat = fsStat;
          urlObject.href = filesystemResolution.url;
          applyFsStatEffectsOnUrlObject(urlObject, fsStat);
        }
      }
      if (spa) {
        // for SPA we want to serve the root HTML file most of the time
        if (!fsStat) {
          if (urlToExtension(urlObject)) {
            // url has an extension, we assume it's a file request -> let 404 happen
            return null;
          }
          const { requestedUrl, rootDirectoryUrl, mainFilePath } =
            reference.ownerUrlInfo.context;
          const closestHtmlRootFile = getClosestHtmlRootFile(
            requestedUrl,
            rootDirectoryUrl,
          );
          if (closestHtmlRootFile) {
            return closestHtmlRootFile;
          }
          return new URL(mainFilePath, rootDirectoryUrl);
        }
        if (fsStat.isDirectory()) {
          // When requesting a directory, check if we have an HTML entry file for that directory
          const directoryEntryFileUrl = getDirectoryEntryFileUrl(urlObject);
          if (directoryEntryFileUrl) {
            reference.fsStat = readEntryStatSync(directoryEntryFileUrl);
            return directoryEntryFileUrl;
          }
        }
      }
      if (!fsStat) {
        return null;
      }
      const urlBeforeSymlinkResolution = urlObject.href;
      if (preserveSymlinks) {
        return `${urlBeforeSymlinkResolution}${search}${hash}`;
      }
      const urlAfterSymlinkResolution = resolveSymlink(
        urlBeforeSymlinkResolution,
      );
      if (urlAfterSymlinkResolution !== urlBeforeSymlinkResolution) {
        reference.leadsToASymlink = true;
        // reference.baseUrl = urlBeforeSymlinkResolution;
      }
      const resolvedUrl = `${urlAfterSymlinkResolution}${search}${hash}`;
      return resolvedUrl;
    },
  };
};

const applyFsStatEffectsOnUrlObject = (urlObject, fsStat) => {
  if (!fsStat) {
    return;
  }
  const { pathname } = urlObject;
  const pathnameUsesTrailingSlash = pathname.endsWith("/");
  // force trailing slash on directories
  if (fsStat.isDirectory()) {
    if (!pathnameUsesTrailingSlash) {
      urlObject.pathname = `${pathname}/`;
    }
  } else if (pathnameUsesTrailingSlash) {
    // otherwise remove trailing slash if any
    // a warning here? (because it's strange to reference a file with a trailing slash)
    urlObject.pathname = pathname.slice(0, -1);
  }
};

const resolveSymlink = (fileUrl) => {
  const urlObject = new URL(fileUrl);
  const realpath = realpathSync(urlObject);
  const realUrlObject = pathToFileURL(realpath);
  if (urlObject.pathname.endsWith("/")) {
    realUrlObject.pathname += `/`;
  }
  return realUrlObject.href;
};

const getDirectoryEntryFileUrl = (directoryUrl) => {
  const indexHtmlFileUrl = new URL(`index.html`, directoryUrl);
  if (existsSync(indexHtmlFileUrl)) {
    return indexHtmlFileUrl.href;
  }
  const filename = urlToFilename(directoryUrl);
  const htmlFileUrlCandidate = new URL(`${filename}.html`, directoryUrl);
  if (existsSync(htmlFileUrlCandidate)) {
    return htmlFileUrlCandidate.href;
  }
  return null;
};
const getClosestHtmlRootFile = (requestedUrl, serverRootDirectoryUrl) => {
  let directoryUrl = new URL("./", requestedUrl);
  while (true) {
    const directoryEntryFileUrl = getDirectoryEntryFileUrl(directoryUrl);
    if (directoryEntryFileUrl) {
      return directoryEntryFileUrl;
    }
    if (!urlIsOrIsInsideOf(directoryUrl, serverRootDirectoryUrl)) {
      return null;
    }
    directoryUrl = new URL("../", directoryUrl);
  }
};
