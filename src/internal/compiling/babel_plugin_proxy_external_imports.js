import { urlToRelativeUrl, fileSystemPathToUrl } from "@jsenv/filesystem"

import { babelPluginImportVisitor } from "./babel_plugin_import_visitor.js"

export const babelPluginProxyExternalImports = (
  babel,
  { jsenvRemoteDirectory },
) => {
  return {
    ...babelPluginImportVisitor(babel, ({ specifierPath, state }) => {
      const specifierNode = specifierPath.node
      if (specifierNode.type === "StringLiteral") {
        const specifier = specifierNode.value
        if (jsenvRemoteDirectory.isRemoteUrl(specifier)) {
          const fileUrl = jsenvRemoteDirectory.fileUrlFromRemoteUrl(specifier)
          const importerFileUrl = fileSystemPathToUrl(state.filename)
          const urlRelativeToProject = urlToRelativeUrl(
            fileUrl,
            importerFileUrl,
          )
          const specifierProxy = `./${urlRelativeToProject}`
          specifierPath.replaceWith(babel.types.stringLiteral(specifierProxy))
        }
      }
    }),
    name: "proxy-external-imports",
  }
}
