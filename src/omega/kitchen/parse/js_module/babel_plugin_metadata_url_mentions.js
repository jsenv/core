import { collectProgramUrlMentions } from "@jsenv/core/src/utils/js_ast/program_url_mentions.js"

export const babelPluginMetadataUrlMentions = () => {
  return {
    name: "metadata-url-mentions",
    visitor: {
      Program(programPath, state) {
        const urlMentions = []
        collectProgramUrlMentions(programPath).forEach(
          ({ type, path, specifierPath }) => {
            const specifierNode = specifierPath.node
            if (specifierNode.type === "StringLiteral") {
              urlMentions.push({
                type,
                path,
                specifier: specifierNode.value,
                start: specifierNode.start,
                end: specifierNode.end,
                line: specifierNode.loc.start.line,
                column: specifierNode.loc.start.column,
              })
            }
          },
        )
        state.file.metadata.urlMentions = urlMentions
      },
    },
  }
}
