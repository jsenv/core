import { createDetailedMessage } from "@jsenv/logger"
import { resolveImport } from "@jsenv/import-map/src/resolveImport.js"

import { tryToFindProjectRelativeUrl } from "@jsenv/core/src/internal/runtime/module-registration.js"

export const createImportResolverForImportmap = async ({
  // projectDirectoryUrl,
  compileServerOrigin,
  compileDirectoryRelativeUrl,
  importMap,
  importMapUrl,
  importDefaultExtension,
  onBareSpecifierError = () => {},
}) => {
  const _resolveImport = (specifier, importer) => {
    return resolveImport({
      specifier,
      importer,
      importMap,
      defaultExtension: importDefaultExtension,
      createBareSpecifierError: ({ specifier, importer }) => {
        const bareSpecifierError = createBareSpecifierError({
          specifier,
          importer:
            tryToFindProjectRelativeUrl(importer, {
              compileServerOrigin,
              compileDirectoryRelativeUrl,
            }) || importer,
          importMapUrl:
            tryToFindProjectRelativeUrl(importMapUrl, {
              compileServerOrigin,
              compileDirectoryRelativeUrl,
            }) || importMapUrl,
          importMap,
        })
        onBareSpecifierError(bareSpecifierError)
        return bareSpecifierError
      },
    })
  }

  return { resolveImport: _resolveImport }
}

const createBareSpecifierError = ({ specifier, importer, importMapUrl }) => {
  const detailedMessage = createDetailedMessage("Unmapped bare specifier.", {
    specifier,
    importer,
    "how to fix": `Add a mapping for "${specifier}" into the importmap file at ${importMapUrl}`,
    "suggestion": `Generate importmap using https://github.com/jsenv/jsenv-node-module-import-map`,
  })

  return new Error(detailedMessage)
}
