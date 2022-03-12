import { applyBabelPlugins } from "@jsenv/core/src/utils/js_ast/apply_babel_plugins.js"
import { createMagicSource } from "@jsenv/core/src/utils/sourcemap/magic_source.js"

import { babelPluginMetadataUrlMentions } from "./babel_plugin_metadata_url_mentions.js"
import { babelPluginMetadataImportMetaHot } from "./babel_plugin_metadata_import_meta_hot.js"

export const parseJsModuleUrlMentions = async ({ url, content }) => {
  const { metadata } = await applyBabelPlugins({
    babelPlugins: [
      [babelPluginMetadataUrlMentions],
      [babelPluginMetadataImportMetaHot],
    ],
    url,
    content,
  })
  const { urlMentions, hotDecline, hotAcceptSelf, hotAcceptDependencies } =
    metadata
  return {
    urlMentions,
    hotDecline,
    hotAcceptSelf,
    hotAcceptDependencies: hotAcceptDependencies.map((hotAcceptDependency) => {
      return {
        type: "js_import_export",
        specifier: hotAcceptDependency,
      }
    }),
    replaceUrls: async (replacements) => {
      const magicSource = createMagicSource({ url, content })
      Object.keys(replacements).forEach((url) => {
        const urlMention = urlMentions.find(
          (urlMention) => urlMention.url === url,
        )
        const { start, end } = urlMention
        magicSource.replace({
          start,
          end,
          replacement: replacements[url],
        })
      })
      return magicSource.toContentAndSourcemap()
    },
  }
}
