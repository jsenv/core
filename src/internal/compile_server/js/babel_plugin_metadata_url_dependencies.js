import { collectProgramUrlReferences } from "@jsenv/core/src/internal/transform_js/program_url_references.js"

// TODO:
// - renommer traverseProgramImports into collectProgramUrlReferences
// - mettre a jour l'utilisation de traverseProgramImports -> collectProgramUrlReferences
// - trouver aussi le new URL('./file.txt', import.meta.url durant collectProgramUrlReferences
// - renommer celui-ci metadata-url-dependencies
export const babelPluginMetadataUrlDependencies = () => {
  return {
    name: "metadata-url-dependencies",
    visitor: {
      Program(path, state) {
        const urlDependencies = []
        collectProgramUrlReferences(path).forEach(({ urlSpecifierPath }) => {
          const specifierNode = urlSpecifierPath.node
          if (specifierNode.type === "StringLiteral") {
            const specifier = specifierNode.value
            urlDependencies.push(specifier)
          }
        })
        state.file.metadata.urlDependencies = urlDependencies
      },
    },
  }
}
