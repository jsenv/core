import { fileSystemPathToUrl } from "@jsenv/filesystem"

import { collectProgramUrlReferences } from "@jsenv/core/src/internal/transform_js/program_url_references.js"

export const babelPluginHmrEsm = (babel, { ressourceGraph }) => {
  return {
    name: "jsenv-hmr-esm",
    visitor: {
      Program(path, state) {
        const urlReferences = collectProgramUrlReferences(path)
        urlReferences.forEach(({ urlSpecifierPath }) => {
          const specifierNode = urlSpecifierPath.node
          if (specifierNode.type !== "StringLiteral") {
            return
          }
          const specifierWithHmr = ressourceGraph.injectHmrIntoSpecifier(
            specifierNode.value,
            fileSystemPathToUrl(state.filename),
          )
          if (specifierWithHmr) {
            urlSpecifierPath.replaceWith(
              babel.types.stringLiteral(specifierWithHmr),
            )
          }
        })
      },
    },
  }
}
