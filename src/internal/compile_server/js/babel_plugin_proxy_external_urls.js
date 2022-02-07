import { urlToRelativeUrl, fileSystemPathToUrl } from "@jsenv/filesystem"

import { collectProgramUrlMentions } from "@jsenv/core/src/internal/transform_js/program_url_mentions.js"

export const babelPluginProxyExternalUrls = (
  babel,
  { jsenvRemoteDirectory },
) => {
  return {
    name: "proxy-external-urls",
    visitor: {
      Program: (path, state) => {
        const urlMentions = collectProgramUrlMentions(path)
        urlMentions.forEach(({ specifierPath }) => {
          const specifierNode = specifierPath.node
          if (specifierNode.type === "StringLiteral") {
            const specifier = specifierNode.value
            if (
              jsenvRemoteDirectory.isRemoteUrl(specifier) &&
              !jsenvRemoteDirectory.isPreservedUrl(specifier)
            ) {
              const fileUrl =
                jsenvRemoteDirectory.fileUrlFromRemoteUrl(specifier)
              const importerFileUrl = fileSystemPathToUrl(state.filename)
              const urlRelativeToProject = urlToRelativeUrl(
                fileUrl,
                importerFileUrl,
              )
              const specifierProxy = `./${urlRelativeToProject}`
              specifierPath.replaceWith(
                babel.types.stringLiteral(specifierProxy),
              )
            }
          }
        })
      },
    },
  }
}
