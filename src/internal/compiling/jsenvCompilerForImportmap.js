import { composeTwoImportMaps } from "@jsenv/importmap"

import { getDefaultImportmap } from "@jsenv/core/src/internal/import-resolution/importmap_default.js"

export const compileImportmap = async ({
  code,
  url,
  compiledUrl,
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileId,
}) => {
  const jsenvImportmap = getDefaultImportmap(compiledUrl, {
    projectDirectoryUrl,
    compileDirectoryUrl: `${projectDirectoryUrl}${outDirectoryRelativeUrl}${compileId}/`,
  })
  const projectImportmap = JSON.parse(code)
  const importmap = composeTwoImportMaps(jsenvImportmap, projectImportmap)

  return {
    contentType: "application/importmap+json",
    compiledSource: JSON.stringify(importmap, null, "  "),
    sources: [url],
    sourcesContent: [code],
    assets: [],
    assetsContent: [],
  }
}
