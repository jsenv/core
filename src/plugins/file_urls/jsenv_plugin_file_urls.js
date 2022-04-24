import { readFileSync } from "node:fs"
import { urlIsInsideOf, urlToRelativeUrl } from "@jsenv/filesystem"

import { CONTENT_TYPE } from "@jsenv/utils/content_type/content_type.js"

export const jsenvPluginFileUrls = () => {
  return [jsenvPluginResolveAbsoluteFileUrls(), jsenvPluginLoadFileUrls()]
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
    resolve: ({ specifier }) => {
      if (!specifier.startsWith("/@fs/")) {
        return null
      }
      const fsRootRelativeUrl = specifier.slice("/@fs/".length)
      return `file:///${fsRootRelativeUrl}`
    },
    formatReferencedUrl: ({ url }, { rootDirectoryUrl }) => {
      if (!url.startsWith("file:")) {
        return null
      }
      if (urlIsInsideOf(url, rootDirectoryUrl)) {
        return `/${urlToRelativeUrl(url, rootDirectoryUrl)}`
      }
      return `/@fs/${url.slice("file:///".length)}`
    },
  }
}

const jsenvPluginLoadFileUrls = () => {
  return {
    name: "jsenv:load_file_urls",
    appliesDuring: "*",
    load: ({ url }) => {
      if (!url.startsWith("file:")) {
        return null
      }
      const urlObject = new URL(url)
      const fileBuffer = readFileSync(urlObject)
      const contentType = CONTENT_TYPE.fromUrlExtension(url)
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
    },
  }
}
