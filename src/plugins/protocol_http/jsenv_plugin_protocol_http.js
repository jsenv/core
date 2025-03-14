import { URL_META } from "@jsenv/url-meta";
import { setUrlExtension, urlToExtension, urlToFilename } from "@jsenv/urls";
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";

export const jsenvPluginProtocolHttp = ({ include }) => {
  const prependIgnore = (reference) => {
    if (reference.original) {
      return `ignore:${reference.original.specifier}`;
    }
    return `ignore:${reference.specifier}`;
  };

  if (include === false) {
    return {
      name: "jsenv:protocol_http",
      appliesDuring: "*",
      redirectReference: (reference) => {
        if (!reference.url.startsWith("http")) {
          return null;
        }
        return prependIgnore(reference);
      },
    };
  }
  const shouldInclude =
    include === true
      ? () => true
      : URL_META.createFilter(include, "http://jsenv.com");

  return {
    name: "jsenv:protocol_http",
    appliesDuring: "build",
    // resolveReference: (reference) => {
    //   if (reference.original && reference.original.url.startsWith("http")) {
    //     return new URL(reference.specifier, reference.original.url);
    //   }
    //   return null;
    // },
    init: (context) => {
      const outDirectoryUrl = context.outDirectoryUrl;
      if (!outDirectoryUrl) {
        throw new Error(`need outDirectoryUrl to write http files`);
      }
    },
    redirectReference: (reference) => {
      if (!reference.url.startsWith("http")) {
        return null;
      }
      if (!shouldInclude(reference.url)) {
        return prependIgnore(reference);
      }
      const outDirectoryUrl = reference.ownerUrlInfo.context.outDirectoryUrl;
      const urlObject = new URL(reference.url);
      const { host, pathname, search } = urlObject;
      let fileUrl = String(outDirectoryUrl);
      if (reference.url.startsWith("http:")) {
        fileUrl += "@http/";
      } else {
        fileUrl += "@https/";
      }
      fileUrl += asValidFilename(host);
      if (pathname) {
        fileUrl += "/";
        fileUrl += asValidFilename(pathname);
      }
      if (search) {
        fileUrl += search;
      }
      return fileUrl;
    },
    fetchUrlContent: async (urlInfo) => {
      const originalUrl = urlInfo.originalUrl;
      if (!originalUrl.startsWith("http")) {
        return null;
      }
      const response = await fetch(originalUrl);
      const responseStatus = response.status;
      if (responseStatus < 200 || responseStatus > 299) {
        throw new Error(`unexpected response status ${responseStatus}`);
      }
      const responseHeaders = response.headers;
      const responseContentType = responseHeaders.get("content-type");
      const contentType = responseContentType || "application/octet-stream";
      const isTextual = CONTENT_TYPE.isTextual(contentType);
      let content;
      if (isTextual) {
        content = await response.text();
      } else {
        content = Buffer.from(await response.arrayBuffer());
      }
      // When fetching content from http it's possible to request something like
      // "https://esm.sh/preact@10.23.1
      // and receive content-type "application/javascript"
      // if we do nothing, after build there will be a "preact@10.23.1" file without ".js" extension
      // and the build server will serve this as "application/octet-stream".
      // We want to build files to be compatible with any server and keep build server logic simple.
      // -> We auto-append the extension corresponding to the content-type
      let filenameHint;
      const extension = urlToExtension(originalUrl);
      if (extension === "") {
        const wellKnownExtensionForThisContentType =
          CONTENT_TYPE.toUrlExtension(contentType);
        if (wellKnownExtensionForThisContentType) {
          const urlWithExtension = setUrlExtension(
            originalUrl,
            wellKnownExtensionForThisContentType,
          );
          filenameHint = urlToFilename(urlWithExtension);
        }
      }

      return {
        content,
        contentType,
        contentLength: responseHeaders.get("content-length") || undefined,
        filenameHint,
      };
    },
  };
};

// see https://github.com/parshap/node-sanitize-filename/blob/master/index.js
const asValidFilename = (string) => {
  string = string.trim().toLowerCase();
  if (string === ".") return "_";
  if (string === "..") return "__";
  string = string.replace(/[ ,]/g, "_").replace(/["/?<>\\:*|]/g, "");
  return string;
};
