import { fileSystemPathToUrl } from "@jsenv/filesystem"

import { collectProgramUrlMentions } from "@jsenv/core/src/internal/transform_js/program_url_mentions.js"

export const babelPluginProxyExternalUrls = (babel, { sourceFileFetcher }) => {
  return {
    name: "proxy-external-urls",
    visitor: {
      Program: (path, state) => {
        const urlMentions = collectProgramUrlMentions(path)
        urlMentions.forEach(({ specifierPath }) => {
          const specifierNode = specifierPath.node
          if (specifierNode.type === "StringLiteral") {
            const specifier = specifierNode.value
            const importerFileUrl = fileSystemPathToUrl(state.filename)
            const newSpecifier = sourceFileFetcher.asFileUrlSpecifierIfRemote(
              specifier,
              importerFileUrl,
            )
            if (newSpecifier !== specifier) {
              specifierPath.replaceWith(babel.types.stringLiteral(newSpecifier))
            }
          }
        })
      },
    },
  }
}
