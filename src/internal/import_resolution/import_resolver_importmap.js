import { createDetailedMessage } from "@jsenv/logger"
import { resolveImport } from "@jsenv/importmap/src/resolveImport.js"

import { applyDefaultExtension } from "./default_extension.js"

export const createImportResolverForImportmap = async ({
  // projectDirectoryUrl,
  urlContext,
  importMap,
  importMapUrl,
  importDefaultExtension,
  onBareSpecifierError = () => {},
}) => {
  const _resolveImport = (specifier, importer) => {
    if (importDefaultExtension) {
      specifier = applyDefaultExtension(specifier, importer)
    }
    return resolveImport({
      specifier,
      importer,
      importMap,
      createBareSpecifierError: ({ specifier, importer }) => {
        const bareSpecifierError = createBareSpecifierError({
          specifier,
          importer: urlContext.asSourceRelativeUrl(importer),
          importMapUrl: urlContext.asSourceRelativeUrl(importMapUrl),
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
    ...(importMapUrl
      ? {
          "how to fix": `Add a mapping for "${specifier}" into the importmap file at "${importMapUrl}"`,
        }
      : {
          "how to fix": `Add an importmap with a mapping for "${specifier}"`,
          "suggestion": `Generate importmap using https://github.com/jsenv/importmap-node-module`,
        }),
  })

  return new Error(detailedMessage)
}
