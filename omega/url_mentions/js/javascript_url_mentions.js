import { urlToRelativeUrl } from "@jsenv/filesystem"

import { babelTransform } from "@jsenv/core/src/internal/transform_js/babel_transform.js"
import { createMagicSource } from "#omega/internal/sourcemap/magic_source.js"

import { babelPluginMetadataUrlMentions } from "./babel_plugin_metadata_url_mentions.js"

export const javaScriptUrlMentions = {
  parse: async ({ url, content }) => {
    const { metadata } = await babelTransform({
      options: {
        plugins: [[babelPluginMetadataUrlMentions]],
      },
      url,
      content,
    })
    const { urlMentions } = metadata
    return urlMentions
  },
  transform: ({ projectDirectoryUrl, url, content, urlMentions }) => {
    const magicSource = createMagicSource({ url, content })
    urlMentions.forEach((urlMention) => {
      magicSource.replace({
        start: urlMention.start,
        end: urlMention.end,
        // TODO: inject hmr if needed
        replacement: JSON.stringify(
          `/${urlToRelativeUrl(urlMention.url, projectDirectoryUrl)}`,
        ),
      })
    })
    return magicSource.toContentAndSourcemap()
  },
}
