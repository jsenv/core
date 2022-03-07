import { readFileSync } from "node:fs"
import { urlToContentType } from "@jsenv/server"

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

const contentTypeIsTextual = (contentType) => {
  if (contentType.startsWith("text/")) {
    return true
  }
  // catch things like application/manifest+json, application/importmap+json
  if (/^application\/\w+\+json$/.test(contentType)) {
    return true
  }
  if (CONTENT_TYPE_AS_TEXT.includes(contentType)) {
    return true
  }
  return false
}
const CONTENT_TYPE_AS_TEXT = [
  "application/javascript",
  "application/json",
  "image/svg+xml",
]
