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
      // must be read before applyFsStatEffectsOnUrlObject which forces the
      // trailing slash on directories
      const specifierUsesTrailingSlash = urlObject.pathname.endsWith("/");
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
          if (specifierUsesTrailingSlash) {
            // the trailing slash asks for a directory and there is none here
            // -> let 404 happen (same reasoning as the extension above)
            return null;
          }
          const spaFallbackUrl = getSpaFallbackUrl(reference);
          if (spaFallbackUrl) {
            return spaFallbackUrl;
          }
          return null;
        }
        if (fsStat.isDirectory()) {
          // When requesting a directory, check if we have an HTML entry file for that directory
          const directoryEntryFileUrl = getDirectoryEntryFileUrl(urlObject);
          if (directoryEntryFileUrl) {
            reference.fsStat = readEntryStatSync(directoryEntryFileUrl);
            return directoryEntryFileUrl;
          }
          if (!specifierUsesTrailingSlash) {
            // the trailing slash is what tells a directory apart from a route:
            // "/join/" is the directory, "/join" is a route owned by the SPA
            // even when "join/" exists in the source files.
            // Without this a source directory would shadow the route having
            // the same name and the SPA would be unreachable in dev while
            // being perfectly fine once built
            const spaFallbackUrl = getSpaFallbackUrl(reference);
            if (spaFallbackUrl) {
              reference.fsStat = readEntryStatSync(spaFallbackUrl, {
                nullIfNotFound: true,
              });
              return spaFallbackUrl;
            }
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
const getSpaFallbackUrl = (reference) => {
  const { requestedUrl, rootDirectoryUrl, mainFilePath } =
    reference.ownerUrlInfo.context;
  if (!requestedUrl) {
    // the SPA fallback answers a request; during build there is none
    return null;
  }
  const spaFallbackFileUrls = listSpaFallbackFileUrls(requestedUrl, {
    rootDirectoryUrl,
    mainFilePath,
  });
  for (const spaFallbackFileUrl of spaFallbackFileUrls) {
    if (existsSync(new URL(spaFallbackFileUrl))) {
      return spaFallbackFileUrl;
    }
  }
  // none exists: the main file it is, and the 404 answering for it lists
  // what was tried (see directory listing)
  return new URL(mainFilePath, rootDirectoryUrl).href;
};
// The html files that can answer a route, closest first: the entry file of
// the route's own directory ("index.html", then "<dirname>.html"), then of
// each directory above it up to the server root, then the main file.
export const listSpaFallbackFileUrls = (
  requestedUrl,
  { rootDirectoryUrl, mainFilePath },
) => {
  const fileUrls = [];
  let directoryUrl = new URL("./", requestedUrl).href;
  while (urlIsOrIsInsideOf(directoryUrl, rootDirectoryUrl)) {
    fileUrls.push(new URL("index.html", directoryUrl).href);
    const filename = urlToFilename(directoryUrl);
    if (filename) {
      fileUrls.push(new URL(`${filename}.html`, directoryUrl).href);
    }
    if (directoryUrl === String(rootDirectoryUrl)) {
      break;
    }
    directoryUrl = new URL("../", directoryUrl).href;
  }
  const mainFileUrl = new URL(mainFilePath, rootDirectoryUrl).href;
  if (!fileUrls.includes(mainFileUrl)) {
    fileUrls.push(mainFileUrl);
  }
  return fileUrls;
};
