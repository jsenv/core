import { babelTransform } from "@jsenv/core/src/internal/transform_js/babel_transform.js"
import { createMagicSource } from "#omega/internal/sourcemap/magic_source.js"

import { babelPluginMetadataUrlMentions } from "./babel_plugin_metadata_url_mentions.js"
import { babelPluginMetadataImportMetaHot } from "./babel_plugin_metadata_import_meta_hot.js"

export const javaScriptUrlMentions = {
  parse: async ({ url, content }) => {
    const { metadata } = await babelTransform({
      options: {
        plugins: [
          [babelPluginMetadataUrlMentions],
          [babelPluginMetadataImportMetaHot],
        ],
      },
      url,
      content,
    })
    const {
      urlMentions,
      hotDecline = false,
      hotAcceptSelf = false,
      hotAcceptDependencies = [],
    } = metadata
    return {
      urlMentions,
      hotDecline,
      hotAcceptSelf,
      hotAcceptDependencies,
    }
  },
  transform: ({ url, content, urlMentions, transformUrlMention }) => {
    const magicSource = createMagicSource({ url, content })
    urlMentions.forEach((urlMention) => {
      magicSource.replace({
        start: urlMention.start,
        end: urlMention.end,
        replacement: JSON.stringify(transformUrlMention(urlMention)),
      })
    })
    return magicSource.toContentAndSourcemap()
  },
}
