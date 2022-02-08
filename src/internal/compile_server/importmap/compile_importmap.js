import { composeTwoImportMaps } from "@jsenv/importmap"

import { getDefaultImportmap } from "@jsenv/core/src/internal/import_resolution/importmap_default.js"

export const compileImportmap = async ({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  url,
  compiledUrl,
  compileId,
  importmapText,
}) => {
  const jsenvImportmap = getDefaultImportmap(compiledUrl, {
    projectDirectoryUrl,
    compileDirectoryUrl: `${projectDirectoryUrl}${jsenvDirectoryRelativeUrl}${compileId}/`,
  })
  const projectImportmap = JSON.parse(importmapText)
  const importmap = composeTwoImportMaps(jsenvImportmap, projectImportmap)

  return {
    contentType: "application/importmap+json",
    content: JSON.stringify(importmap, null, "  "),
    sources: [url],
    sourcesContent: [importmapText],
    assets: [],
    assetsContent: [],
  }
}
