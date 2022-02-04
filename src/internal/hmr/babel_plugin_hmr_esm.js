import { fileSystemPathToUrl } from "@jsenv/filesystem"

import { traverseProgramImports } from "@jsenv/core/src/internal/transform_js/traverse_program_imports.js"

export const babelPluginHmrEsm = (babel, { ressourceGraph }) => {
  return {
    name: "jsenv-hmr-esm",
    visitor: {
      Program(path, state) {
        traverseProgramImports(path, ({ specifierPath }) => {
          const specifierNode = specifierPath.node
          if (specifierNode.type !== "StringLiteral") {
            return
          }
          const specifierWithHmr = ressourceGraph.injectHmrIntoSpecifier(
            specifierNode.value,
            fileSystemPathToUrl(state.filename),
          )
          if (specifierWithHmr) {
            specifierPath.replaceWith(
              babel.types.stringLiteral(specifierWithHmr),
            )
          }
        })
      },
    },
  }
}
