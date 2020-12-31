import { urlToContentType } from "@jsenv/server"
import { resolveUrl } from "@jsenv/util"
import { transformImportmap } from "./transformImportmap.js"

export const jsenvCompilerForImportmap = ({
  projectDirectoryUrl,
  importMapFileRelativeUrl,
  originalFileUrl,
}) => {
  const contentType = urlToContentType(originalFileUrl)

  if (contentType !== "application/importmap+json") {
    return null
  }

  const importMapFileUrl = resolveUrl(importMapFileRelativeUrl, projectDirectoryUrl)

  return {
    // allow project to have no importmap
    fileContentFallbackIfNotFound: originalFileUrl === importMapFileUrl ? "{}" : undefined,
    compile: (importmapBeforeTransformation) => {
      return transformImportmap(importmapBeforeTransformation, {
        originalFileUrl,
      })
    },
  }
}
