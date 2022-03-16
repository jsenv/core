import { collectProgramUrlMentions } from "@jsenv/core/src/utils/js_ast/program_url_mentions.js"

import { applyBabelPlugins } from "@jsenv/core/src/utils/js_ast/apply_babel_plugins.js"
import { createMagicSource } from "@jsenv/core/src/utils/sourcemap/magic_source.js"

export const parseJsModuleUrlMentions = async ({ url, content }) => {
  const { metadata } = await applyBabelPlugins({
    babelPlugins: [babelPluginMetadataUrlMentions],
    url,
    content,
  })
  const { urlMentions } = metadata
  return {
    urlMentions,
    replaceUrls: async (replacements) => {
      const magicSource = createMagicSource({ url, content })
      replacements.forEach(({ urlMentionIndex, value }) => {
        const urlMention = urlMentions[urlMentionIndex]
        const { start, end } = urlMention
        magicSource.replace({
          start,
          end,
          replacement: value,
        })
      })
      return magicSource.toContentAndSourcemap()
    },
  }
}

const babelPluginMetadataUrlMentions = () => {
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
