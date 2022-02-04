import {
  fileSystemPathToUrl,
  urlIsInsideOf,
  urlToRelativeUrl,
} from "@jsenv/filesystem"

import { traverseProgramImports } from "@jsenv/core/src/internal/compile_server/js/traverse_program_imports.js"

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
          const specifier = specifierNode.value
          const fileUrl = fileSystemPathToUrl(state.filename)
          const url = ressourceGraph.applyImportmapResolution(
            specifier,
            fileUrl,
          )
          if (!urlIsInsideOf(url, fileUrl)) {
            return
          }
          const urlWithHmr = ressourceGraph.injectHmrIntoUrl(url)
          if (!urlWithHmr) {
            return
          }
          const specifierWithHmr = `${urlToRelativeUrl(urlWithHmr, fileUrl)}`
          specifierPath.replaceWith(babel.types.stringLiteral(specifierWithHmr))
        })
      },
    },
  }
}
