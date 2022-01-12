import { babelPluginImportVisitor } from "./babel_plugin_import_visitor.js"

export const babelPluginProxyExternalImports = (babel) => {
  return {
    ...babelPluginImportVisitor(babel, ({ specifierPath }) => {
      const specifierProxy = `./?external_url=${encodeURIComponent(
        specifierPath.node.value,
      )}`
      specifierPath.replaceWith(babel.types.stringLiteral(specifierProxy))
    }),
    name: "proxy-external-imports",
  }
}
