import { fileSystemPathToUrl } from "@jsenv/filesystem"

import { collectProgramUrlMentions } from "@jsenv/core/src/internal/transform_js/program_url_mentions.js"

export const babelPluginHmrEsm = (babel, { ressourceGraph }) => {
  return {
    name: "jsenv-hmr-esm",
    visitor: {
      Program(path, state) {
        const urlMentions = collectProgramUrlMentions(path)
        urlMentions.forEach(({ specifierPath }) => {
          const specifierNode = specifierPath.node
          if (specifierNode.type !== "StringLiteral") {
            return
          }
          const specifierWithHmr = ressourceGraph.injectHmrIntoUrlSpecifier(
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
