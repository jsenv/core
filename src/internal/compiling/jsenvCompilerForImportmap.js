import { urlToContentType } from "@jsenv/server"
import { transformImportmap } from "./transformImportmap.js"

export const jsenvCompilerForImportmap = ({
  logger,
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  originalFileUrl,
  compiledFileUrl,
}) => {
  const contentType = urlToContentType(originalFileUrl)

  if (contentType !== "application/importmap+json") {
    return null
  }

  return {
    compile: (importmapBeforeTransformation) => {
      return transformImportmap(importmapBeforeTransformation, {
        logger,
        projectDirectoryUrl,
        outDirectoryRelativeUrl,
        originalFileUrl,
        compiledFileUrl,
      })
    },
  }
}
