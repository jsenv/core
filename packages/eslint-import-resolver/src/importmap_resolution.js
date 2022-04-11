import { resolveImport } from "@jsenv/importmap"

import { readImportmap } from "./read_importmap.js"

export const applyImportmapResolution = (
  specifier,
  {
    logger,
    rootDirectoryUrl,
    importmapFileRelativeUrl,
    importDefaultExtension,
    importer,
  },
) => {
  const importmap = readImportmap({
    logger,
    rootDirectoryUrl,
    importmapFileRelativeUrl,
  })
  try {
    return resolveImport({
      specifier,
      importer,
      // by passing importMap to null resolveImport behaves
      // almost like new URL(specifier, importer)
      // we want to force the importmap resolution
      // so that bare specifiers are considered unhandled
      // even if there is no importmap file
      importMap: importmap || {},
      defaultExtension: importDefaultExtension,
    })
  } catch (e) {
    if (e.message.includes("bare specifier")) {
      logger.debug("unmapped bare specifier")
      return null
    }
    throw e
  }
}
