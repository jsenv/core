import { traverseProgramImports } from "./traverse_program_imports.js"

export const babelPluginImportMetadata = () => {
  return {
    name: "import-metadata",
    visitor: {
      Program(path) {
        traverseProgramImports(path, ({ state, specifierPath }) => {
          const specifierNode = specifierPath.node
          if (specifierNode.type === "StringLiteral") {
            const specifier = specifierNode.value
            const { metadata } = state.file
            metadata.dependencies = [
              ...(metadata.dependencies ? metadata.dependencies : []),
              specifier,
            ]
          }
        })
      },
    },
  }
}
