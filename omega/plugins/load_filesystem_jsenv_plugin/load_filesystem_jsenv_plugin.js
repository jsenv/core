import { readFile } from "@jsenv/filesystem"

export const loadFileSystemJsenvPlugin = () => {
  return {
    name: "jsenv:load_filesystem",

    load: async ({ url, contentType }) => {
      if (!url.startsWith("file://")) {
        return null
      }
      const content = await readFile(url, {
        as: contentTypeIsTextual(contentType) ? "string" : "buffer",
      })
      return { content }
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
