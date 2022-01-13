import { babelPluginImportVisitor } from "./babel_plugin_import_visitor.js"

export const babelPluginImportMetadata = (babel) => {
  return {
    ...babelPluginImportVisitor(babel, ({ state, specifierPath }) => {
      const specifierNode = specifierPath.node
      if (specifierNode.type === "StringLiteral") {
        const specifier = specifierNode.value
        const { metadata } = state.file
        metadata.dependencies = [
          ...(metadata.dependencies ? metadata.dependencies : []),
          specifier,
        ]
      }
    }),
    name: "import-metadata",
  }
}
