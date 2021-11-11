import { babelPluginImportVisitor } from "./babel_plugin_import_visitor.js"

export const babelPluginImportMetadata = (babel) => {
  return {
    ...babelPluginImportVisitor(
      babel,
      // During the build we throw when for import call expression where
      // sepcifier or type is dynamic.
      // Here there is no strong need to throw because keeping the source code intact
      // will throw an error when browser will execute the code
      ({ state, specifierPath }) => {
        const { metadata } = state.file

        metadata.dependencies = [
          ...(metadata.dependencies ? metadata.dependencies : []),
          specifierPath.node.value,
        ]
      },
    ),
    name: "import-metadata",
  }
}
