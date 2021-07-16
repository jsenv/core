import { urlToContentType } from "@jsenv/server"
import { transformImportmap } from "./transformImportmap.js"

export const jsenvCompilerForImportmap = {
  "jsenv-compiler-importmap": compileImportmapFile,
}

const compileImportmapFile = ({ originalFileUrl }) => {
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
