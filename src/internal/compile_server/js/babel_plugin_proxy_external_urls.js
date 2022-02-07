import { urlToRelativeUrl, fileSystemPathToUrl } from "@jsenv/filesystem"

import { collectProgramUrlReferences } from "@jsenv/core/src/internal/transform_js/program_url_references.js"

export const babelPluginProxyExternalUrls = (
  babel,
  { jsenvRemoteDirectory },
) => {
  return {
    name: "proxy-external-urls",
    visitor: {
      Program: (path, state) => {
        const urlReferences = collectProgramUrlReferences(path)
        urlReferences.forEach(({ urlSpecifierPath }) => {
          const specifierNode = urlSpecifierPath.node
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
              urlSpecifierPath.replaceWith(
                babel.types.stringLiteral(specifierProxy),
              )
            }
          }
        })
      },
    },
  }
}
