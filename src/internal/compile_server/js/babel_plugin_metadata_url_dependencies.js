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
        collectProgramUrlReferences(path).forEach(
          ({ type, urlSpecifierPath }) => {
            const urlSpecifierNode = urlSpecifierPath.node
            if (urlSpecifierNode.type === "StringLiteral") {
              urlDependencies.push({
                type,
                urlSpecifier: urlSpecifierNode.value,
              })
            }
          },
        )
        state.file.metadata.urlDependencies = urlDependencies
      },
    },
  }
}
