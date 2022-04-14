import { readFileSync } from "node:fs"
import {
  urlIsInsideOf,
  urlToRelativeUrl,
  fileSystemRootUrl,
} from "@jsenv/filesystem"

import { ContentType } from "@jsenv/utils/content_type/content_type.js"

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
    resolve: ({ specifier }, { rootDirectoryUrl }) => {
      if (!specifier.startsWith("/@fs/")) {
        return null
      }
      const url = new URL(specifier.slice("/@fs".length), rootDirectoryUrl).href
      return url
    },
    formatReferencedUrl: ({ url }, { rootDirectoryUrl }) => {
      if (!url.startsWith("file:")) {
        return null
      }
      const specifier = urlIsInsideOf(url, rootDirectoryUrl)
        ? `/${urlToRelativeUrl(url, rootDirectoryUrl)}`
        : `/@fs/${url.slice(fileSystemRootUrl.length)}`
      return specifier
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
      const contentType = ContentType.fromUrl(url)
      if (ContentType.isTextual(contentType)) {
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
