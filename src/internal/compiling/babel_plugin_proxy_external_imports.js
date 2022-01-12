import { urlToRelativeUrl, fileSystemPathToUrl } from "@jsenv/filesystem"

import { externalUrlConverter } from "./external_url_converter.js"
import { babelPluginImportVisitor } from "./babel_plugin_import_visitor.js"

export const babelPluginProxyExternalImports = (
  babel,
  { projectDirectoryUrl, jsenvDirectoryRelativeUrl },
) => {
  const jsenvHttpDirectoryUrl = `${projectDirectoryUrl}${jsenvDirectoryRelativeUrl}.http/`

  return {
    ...babelPluginImportVisitor(babel, ({ specifierPath, state }) => {
      const specifierNode = specifierPath.node
      if (specifierNode.type === "StringLiteral") {
        const specifier = specifierNode.value
        if (specifier.startsWith("http:") || specifier.startsWith("https:")) {
          const fileRelativeUrl =
            externalUrlConverter.toFileRelativeUrl(specifier)
          const { search } = new URL(specifier)
          const urlAsFile = `${jsenvHttpDirectoryUrl}${fileRelativeUrl}`
          const importerFileUrl = fileSystemPathToUrl(state.filename)
          // c'est pas relative to project qu'il faut mais relative au fichier actuel
          const urlRelativeToProject = urlToRelativeUrl(
            urlAsFile,
            importerFileUrl,
          )
          const specifierProxy = `./${urlRelativeToProject}${search}`
          specifierPath.replaceWith(babel.types.stringLiteral(specifierProxy))
        }
      }
    }),
    name: "proxy-external-imports",
  }
}
