import { readFileSync } from "node:fs"
import { urlToContentType } from "@jsenv/server"

import { contentTypeIsTextual } from "@jsenv/core/src/utils/content_type.js"

export const jsenvPluginFileUrls = () => {
  return {
    name: "jsenv:file_urls",
    appliesDuring: "*",
    load: ({ url }) => {
      if (!url.startsWith("file:")) {
        return null
      }
      const urlObject = new URL(url)
      const fileBuffer = readFileSync(urlObject)
      const contentType = urlToContentType(url)
      if (contentTypeIsTextual(contentType)) {
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
