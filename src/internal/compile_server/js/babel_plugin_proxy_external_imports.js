import { urlToRelativeUrl, fileSystemPathToUrl } from "@jsenv/filesystem"

import { traverseProgramImports } from "@jsenv/core/src/internal/transform_js/traverse_program_imports.js"

export const babelPluginProxyExternalImports = (
  babel,
  { jsenvRemoteDirectory },
) => {
  return {
    name: "proxy-external-imports",
    visitor: {
      Program: (path) => {
        traverseProgramImports(path, ({ specifierPath, state }) => {
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
