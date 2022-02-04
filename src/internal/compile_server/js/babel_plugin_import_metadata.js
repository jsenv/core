import { traverseProgramImports } from "@jsenv/core/src/internal/transform_js/traverse_program_imports.js"

export const babelPluginImportMetadata = () => {
  return {
    name: "import-metadata",
    visitor: {
      Program(path, state) {
        const dependencies = []
        traverseProgramImports(path, ({ specifierPath }) => {
          const specifierNode = specifierPath.node
          if (specifierNode.type === "StringLiteral") {
            const specifier = specifierNode.value

            dependencies.push(specifier)
          }
        })
        state.file.metadata.dependencies = dependencies
      },
    },
  }
}
