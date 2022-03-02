import { babelTransform } from "@jsenv/core/src/internal/transform_js/babel_transform.js"
import { createMagicSource } from "#omega/internal/sourcemap/magic_source.js"

import { babelPluginMetadataUrlMentions } from "./babel_plugin_metadata_url_mentions.js"
import { babelPluginMetadataImportMetaHot } from "./babel_plugin_metadata_import_meta_hot.js"

export const parseJsModuleUrlMentions = async ({
  url,
  urlFacade,
  contentType,
  content,
}) => {
  if (contentType !== "application/javascript") {
    return null
  }
  if (new URL(urlFacade).searchParams.has("script")) {
    return null
  }
  const { metadata } = await babelTransform({
    options: {
      plugins: [
        [babelPluginMetadataUrlMentions],
        [babelPluginMetadataImportMetaHot],
      ],
    },
    url: urlFacade,
    content,
  })

  const { urlMentions, hotDecline, hotAcceptSelf, hotAcceptDependencies } =
    metadata
  return {
    urlMentions,
    getHotInfo: () => {
      return {
        hotDecline,
        hotAcceptSelf,
        hotAcceptDependencies,
      }
    },
    transformUrlMentions: ({ transformUrlMention }) => {
      const magicSource = createMagicSource({ url, content })
      urlMentions.forEach((urlMention) => {
        const replacement = JSON.stringify(transformUrlMention(urlMention))
        const { start, end } = urlMention
        magicSource.replace({
          start,
          end,
          replacement,
        })
      })
      return magicSource.toContentAndSourcemap()
    },
  }
}
