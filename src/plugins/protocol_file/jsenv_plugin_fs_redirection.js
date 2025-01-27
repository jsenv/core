import { readEntryStatSync } from "@jsenv/filesystem";
import {
  applyFileSystemMagicResolution,
  getExtensionsToTry,
} from "@jsenv/node-esm-resolution";
import { urlToExtension, urlToPathname } from "@jsenv/urls";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const jsenvPluginFsRedirection = ({
  magicExtensions = ["inherit", ".js"],
  magicDirectoryIndex = true,
  preserveSymlinks = false,
}) => {
  return {
    name: "jsenv:fs_redirection",
    appliesDuring: "*",
    redirectReference: (reference) => {
      // http, https, data, about, ...
      if (!reference.url.startsWith("file:")) {
        return null;
      }
      if (reference.isInline) {
        return null;
      }
      if (reference.url === "file:///" || reference.url === "file://") {
        return `ignore:file:///`;
      }
      // ignore all new URL second arg
      if (reference.subtype === "new_url_second_arg") {
        return `ignore:${reference.url}`;
      }
      if (
        reference.specifierPathname.endsWith("/...") ||
        reference.specifierPathname.endsWith("/.../")
      ) {
        const { rootDirectoryUrl } = reference.ownerUrlInfo.context;
        const directoryUrl = new URL(
          reference.specifierPathname.replace("/...", "/").slice(1),
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
      if (!fsStat) {
        // for SPA we want to serve the root HTML file only when:
        // 1. There is no corresponding file on the filesystem
        // 2. The url pathname does not have an extension
        //    This point assume client is requesting a file when there is an extension
        //    and it assumes all routes will not use extension
        // 3. The url pathname does not ends with "/"
        //    In that case we assume client explicitely asks to load a directory
        if (
          !urlToExtension(urlObject) &&
          !urlToPathname(urlObject).endsWith("/")
        ) {
          const { mainFilePath, rootDirectoryUrl } =
            reference.ownerUrlInfo.context;
          return new URL(mainFilePath, rootDirectoryUrl);
        }
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
