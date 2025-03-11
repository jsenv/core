import { resolveImport } from "@jsenv/importmap";

export const applyImportmapResolution = (
  specifier,
  importer,
  importmap,
  { logger, importDefaultExtension },
) => {
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
    });
  } catch (e) {
    if (e.message.includes("bare specifier")) {
      logger.debug("unmapped bare specifier");
      return null;
    }
    throw e;
  }
};
