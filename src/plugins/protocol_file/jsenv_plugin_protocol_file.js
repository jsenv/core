import { readFileSync, realpathSync, statSync } from "node:fs";
import { serveDirectory } from "@jsenv/server";
import { pathToFileURL } from "node:url";
import {
  urlIsInsideOf,
  urlToRelativeUrl,
  urlToFilename,
  ensurePathnameTrailingSlash,
} from "@jsenv/urls";
import {
  applyFileSystemMagicResolution,
  getExtensionsToTry,
} from "@jsenv/node-esm-resolution";
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";

export const jsenvPluginProtocolFile = ({
  magicExtensions = ["inherit", ".js"],
  magicDirectoryIndex = true,
  preserveSymlinks = false,
  directoryReferenceEffect = "error",
}) => {
  return [
    {
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
        // ignore root file url
        if (reference.url === "file:///" || reference.url === "file://") {
          reference.leadsToADirectory = true;
          return `ignore:file:///`;
        }
        // ignore "./" on new URL("./")
        if (
          reference.subtype === "new_url_first_arg" &&
          reference.specifier === "./"
        ) {
          return `ignore:${reference.url}`;
        }
        // ignore all new URL second arg
        if (reference.subtype === "new_url_second_arg") {
          return `ignore:${reference.url}`;
        }

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
        const shouldApplyDilesystemMagicResolution =
          reference.type === "js_import";
        if (shouldApplyDilesystemMagicResolution) {
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
        reference.leadsToADirectory = stat && stat.isDirectory();
        if (reference.leadsToADirectory) {
          let actionForDirectory;
          if (
            reference.type === "http_request" ||
            reference.type === "filesystem"
          ) {
            actionForDirectory = "copy";
          } else if (typeof directoryReferenceEffect === "string") {
            actionForDirectory = directoryReferenceEffect;
          } else if (typeof directoryReferenceEffect === "function") {
            actionForDirectory = directoryReferenceEffect(reference);
          } else {
            actionForDirectory = "error";
          }
          if (actionForDirectory === "error") {
            const error = new Error("Reference leads to a directory");
            error.code = "DIRECTORY_REFERENCE_NOT_ALLOWED";
            throw error;
          }
          if (actionForDirectory === "preserve") {
            return `ignore:${url}${search}${hash}`;
          }
        }
        const urlRaw = preserveSymlinks ? url : resolveSymlink(url);
        const resolvedUrl = `${urlRaw}${search}${hash}`;
        return resolvedUrl;
      },
    },
    {
      name: "jsenv:fs_resolution",
      appliesDuring: "*",
      resolveReference: {
        filesystem: (reference) => {
          const ownerUrlInfo = reference.ownerUrlInfo;
          const baseUrl =
            ownerUrlInfo.type === "directory"
              ? ensurePathnameTrailingSlash(ownerUrlInfo.url)
              : ownerUrlInfo.url;
          return new URL(reference.specifier, baseUrl).href;
        },
      },
    },
    {
      name: "jsenv:@fs",
      // during build it's fine to use "file://"" urls
      // but during dev it's a browser running the code
      // so absolute file urls needs to be relativized
      appliesDuring: "dev",
      resolveReference: (reference) => {
        if (reference.specifier.startsWith("/@fs/")) {
          const fsRootRelativeUrl = reference.specifier.slice("/@fs/".length);
          return `file:///${fsRootRelativeUrl}`;
        }
        return null;
      },
      formatReference: (reference) => {
        if (!reference.generatedUrl.startsWith("file:")) {
          return null;
        }
        const { rootDirectoryUrl } = reference.ownerUrlInfo.context;
        if (urlIsInsideOf(reference.generatedUrl, rootDirectoryUrl)) {
          return `/${urlToRelativeUrl(
            reference.generatedUrl,
            rootDirectoryUrl,
          )}`;
        }
        return `/@fs/${reference.generatedUrl.slice("file:///".length)}`;
      },
    },
    {
      name: "jsenv:file_url_fetching",
      appliesDuring: "*",
      fetchUrlContent: (urlInfo) => {
        if (!urlInfo.url.startsWith("file:")) {
          return null;
        }
        const urlObject = new URL(urlInfo.url);
        if (urlInfo.firstReference.leadsToADirectory) {
          if (!urlInfo.filenameHint) {
            if (urlInfo.firstReference.type === "filesystem") {
              urlInfo.filenameHint = `${
                urlInfo.firstReference.ownerUrlInfo.filenameHint
              }${urlToFilename(urlInfo.url)}/`;
            } else {
              urlInfo.filenameHint = `${urlToFilename(urlInfo.url)}/`;
            }
          }
          const { headers, body } = serveDirectory(urlObject.href, {
            headers: urlInfo.context.request
              ? urlInfo.context.request.headers
              : {},
            rootDirectoryUrl: urlInfo.context.rootDirectoryUrl,
          });
          return {
            type: "directory",
            contentType: headers["content-type"],
            contentLength: headers["content-length"],
            content: body,
          };
        }
        if (
          !urlInfo.dirnameHint &&
          urlInfo.firstReference.ownerUrlInfo.type === "directory"
        ) {
          urlInfo.dirnameHint =
            urlInfo.firstReference.ownerUrlInfo.filenameHint;
        }
        const fileBuffer = readFileSync(urlObject);
        const contentType = CONTENT_TYPE.fromUrlExtension(urlInfo.url);
        const content = CONTENT_TYPE.isTextual(contentType)
          ? String(fileBuffer)
          : fileBuffer;
        return {
          content,
          contentType,
        };
      },
    },
  ];
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
