import { composeTwoImportMaps } from "@jsenv/importmap"

import { getDefaultImportmap } from "@jsenv/core/src/internal/import_resolution/importmap_default.js"

export const compileImportmap = async ({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  url,
  compiledUrl,
  compileId,
  content,
}) => {
  const jsenvImportmap = getDefaultImportmap(compiledUrl, {
    projectDirectoryUrl,
    compileDirectoryUrl: `${projectDirectoryUrl}${jsenvDirectoryRelativeUrl}${compileId}/`,
  })
  const projectImportmap = JSON.parse(content)
  const importmap = composeTwoImportMaps(jsenvImportmap, projectImportmap)

  return {
    contentType: "application/importmap+json",
    content: JSON.stringify(importmap, null, "  "),
    sources: [url],
    sourcesContent: [content],
    assets: [],
    assetsContent: [],
  }
}
