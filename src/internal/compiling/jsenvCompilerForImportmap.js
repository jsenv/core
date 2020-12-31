import { urlToContentType } from "@jsenv/server"
import { transformImportmap } from "./transformImportmap.js"

export const jsenvCompilerForImportmap = ({ originalFileUrl }) => {
  const contentType = urlToContentType(originalFileUrl)

  if (contentType !== "application/importmap+json") {
    return null
  }

  return {
    compile: (importmapBeforeTransformation) => {
      return transformImportmap(importmapBeforeTransformation, {
        originalFileUrl,
      })
    },
  }
}
