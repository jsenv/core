import { statSync, readFileSync } from "node:fs"
import { serveDirectory } from "@jsenv/server"

export const jsenvPluginFileUrls = () => {
  return {
    name: "jsenv:file_urls",
    appliesDuring: "*",
    load: async ({ projectDirectoryUrl, url, contentType }) => {
      if (!url.startsWith("file:")) {
        return null
      }
      const urlObject = new URL(url)
      if (statSync(urlObject).isDirectory()) {
        return {
          response: serveDirectory(url, {
            headers: {
              accept: "text/html",
            },
            canReadDirectory: true,
            rootDirectoryUrl: projectDirectoryUrl,
          }),
        }
      }
      const fileBuffer = readFileSync(urlObject)
      if (contentTypeIsTextual(contentType)) {
        return {
          content: String(fileBuffer),
        }
      }
      return {
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
