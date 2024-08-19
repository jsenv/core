import { URL_META } from "@jsenv/url-meta";
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";

export const jsenvPluginProtocolHttp = ({ include }) => {
  if (include === false) {
    return {
      name: "jsenv:protocol_http",
      appliesDuring: "*",
      redirectReference: (reference) => {
        if (
          !reference.url.startsWith("http:") &&
          !reference.url.startsWith("https:")
        ) {
          return null;
        }
        return `ignore:${reference.url}`;
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
    redirectReference: (reference) => {
      if (
        !reference.url.startsWith("http:") &&
        !reference.url.startsWith("https:")
      ) {
        return null;
      }
      if (!shouldInclude(reference.url)) {
        return `ignore:${reference.url}`;
      }
      return null;
    },
    fetchUrlContent: async (urlInfo) => {
      if (
        !urlInfo.url.startsWith("http:") &&
        !urlInfo.url.startsWith("https:")
      ) {
        return null;
      }
      const response = await fetch(urlInfo.originalUrl);
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
        content = await response.buffer;
      }
      return {
        content,
        contentType,
        contentLength: responseHeaders.get("content-length") || undefined,
      };
    },
  };
};
