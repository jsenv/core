import { urlIsInsideOf, urlToRelativeUrl } from "@jsenv/filesystem"

import { filesystemRootUrl } from "@jsenv/core/src/utils/url_utils.js"

export const jsenvPluginFileSystemAbsolute = () => {
  return {
    name: "jsenv:filesystem_absolute",
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
    formatReferencedUrl: ({ type, url }, { baseUrl, rootDirectoryUrl }) => {
      if (!url.startsWith("file:")) {
        return null
      }
      const specifier = urlIsInsideOf(url, rootDirectoryUrl)
        ? `${baseUrl}${urlToRelativeUrl(url, rootDirectoryUrl)}`
        : `${baseUrl}@fs/${url.slice(filesystemRootUrl.length)}`
      const formatter = {
        js_import_export: JSON.stringify,
        js_import_meta_url_pattern: JSON.stringify,
      }[type]
      return formatter ? formatter(specifier) : specifier
    },
  }
}
