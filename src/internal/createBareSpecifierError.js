import { createDetailedMessage } from "@jsenv/logger"

export const createBareSpecifierError = ({ specifier, importer, importMapUrl }) => {
  const detailedMessage = createDetailedMessage("Unmapped bare specifier.", {
    specifier,
    importer,
    "how to fix": `Add a mapping for "${specifier}" into the importmap file at ${importMapUrl}`,
    "suggestion": `Generate importmap using https://github.com/jsenv/jsenv-node-module-import-map`,
  })

  return new Error(detailedMessage)
}
