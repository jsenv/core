import {
  applyFileSystemMagicResolution,
  getExtensionsToTry,
} from "@jsenv/node-esm-resolution";
import { realpathSync, statSync } from "node:fs";
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
        reference.leadsToADirectory = true;
        return `ignore:file:///`;
      }
      // ignore all new URL second arg
      if (reference.subtype === "new_url_second_arg") {
        return `ignore:${reference.url}`;
      }
      // ignore "./" on new URL("./")
      // if (
      //   reference.subtype === "new_url_first_arg" &&
      //   reference.specifier === "./"
      // ) {
      //   return `ignore:${reference.url}`;
      // }

      const urlObject = new URL(reference.url);
      let stat;
      try {
        stat = statSync(urlObject);
      } catch (e) {
        if (e.code === "ENOENT") {
          stat = null;
        } else {
          throw e;
        }
      }

      const { search, hash } = urlObject;
      let { pathname } = urlObject;
      const pathnameUsesTrailingSlash = pathname.endsWith("/");
      urlObject.search = "";
      urlObject.hash = "";
      // force trailing slash on directories
      if (stat && stat.isDirectory() && !pathnameUsesTrailingSlash) {
        urlObject.pathname = `${pathname}/`;
      }
      // otherwise remove trailing slash if any
      if (stat && !stat.isDirectory() && pathnameUsesTrailingSlash) {
        // a warning here? (because it's strange to reference a file with a trailing slash)
        urlObject.pathname = pathname.slice(0, -1);
      }
      let url = urlObject.href;
      const shouldApplyFilesystemMagicResolution =
        reference.type === "js_import";
      if (shouldApplyFilesystemMagicResolution) {
        const filesystemResolution = applyFileSystemMagicResolution(url, {
          fileStat: stat,
          magicDirectoryIndex,
          magicExtensions: getExtensionsToTry(
            magicExtensions,
            reference.ownerUrlInfo.url,
          ),
        });
        if (filesystemResolution.stat) {
          stat = filesystemResolution.stat;
          url = filesystemResolution.url;
        }
      }
      if (!stat) {
        return null;
      }
      const urlRaw = preserveSymlinks ? url : resolveSymlink(url);
      const resolvedUrl = `${urlRaw}${search}${hash}`;
      return resolvedUrl;
    },
  };
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
