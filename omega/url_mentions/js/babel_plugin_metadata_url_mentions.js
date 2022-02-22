import { collectProgramUrlMentions } from "@jsenv/core/src/internal/transform_js/program_url_mentions.js"

export const babelPluginMetadataUrlMentions = () => {
  return {
    name: "metadata-url-mentions",
    visitor: {
      Program(path, state) {
        const urlMentions = []
        collectProgramUrlMentions(path).forEach(({ type, specifierPath }) => {
          const specifierNode = specifierPath.node
          if (specifierNode.type === "StringLiteral") {
            urlMentions.push({
              type,
              specifier: specifierNode.value,
              start: specifierNode.start,
              end: specifierNode.end,
            })
          }
        })
        state.file.metadata.urlMentions = urlMentions
      },
    },
  }
}
