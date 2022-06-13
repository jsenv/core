import { readFileSync } from "node:fs"
import { urlIsInsideOf, urlToRelativeUrl } from "@jsenv/filesystem"

import { CONTENT_TYPE } from "@jsenv/utils/content_type/content_type.js"

export const jsenvPluginFileUrls = ({ directoryReferenceAllowed = false }) => {
  return [
    jsenvPluginResolveAbsoluteFileUrls(),
    jsenvPluginFetchFileUrls({ directoryReferenceAllowed }),
  ]
}

const jsenvPluginResolveAbsoluteFileUrls = () => {
  return {
    name: "jsenv:resolve_absolute_file_urls",
    appliesDuring: {
      // during dev and test it's a browser running the code
      // so absolute file urls needs to be relativized
      dev: true,
      test: true,
      // during build it's fine to use file:// urls
      build: false,
    },
    resolveUrl: (reference) => {
      if (!reference.specifier.startsWith("/@fs/")) {
        return null
      }
      const fsRootRelativeUrl = reference.specifier.slice("/@fs/".length)
      return `file:///${fsRootRelativeUrl}`
    },
    formatUrl: (reference, context) => {
      if (!reference.generatedUrl.startsWith("file:")) {
        return null
      }
      if (urlIsInsideOf(reference.generatedUrl, context.rootDirectoryUrl)) {
        return `/${urlToRelativeUrl(
          reference.generatedUrl,
          context.rootDirectoryUrl,
        )}`
      }
      return `/@fs/${reference.generatedUrl.slice("file:///".length)}`
    },
  }
}

const jsenvPluginFetchFileUrls = ({ directoryReferenceAllowed }) => {
  return {
    name: "jsenv:fetch_file_urls",
    appliesDuring: "*",
    fetchUrlContent: (urlInfo) => {
      if (!urlInfo.url.startsWith("file:")) {
        return null
      }
      const urlObject = new URL(urlInfo.url)
      try {
        const fileBuffer = readFileSync(urlObject)
        const contentType = CONTENT_TYPE.fromUrlExtension(urlInfo.url)
        if (CONTENT_TYPE.isTextual(contentType)) {
          return {
            contentType,
            content: String(fileBuffer),
          }
        }
        return {
          contentType,
          content: fileBuffer,
        }
      } catch (e) {
        if (e.code === "EISDIR" && directoryReferenceAllowed) {
          if (directoryReferenceAllowed) {
            return {
              type: "directory",
              content: "",
            }
          }
        }
        throw e
      }
    },
  }
}
