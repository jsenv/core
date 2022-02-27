import { urlToExtension } from "@jsenv/filesystem"

import { babelTransform } from "@jsenv/core/src/internal/transform_js/babel_transform.js"
import { createMagicString } from "#omega/internal/sourcemap/magic_string.js"

import { babelPluginMetadataUrlMentions } from "./babel_plugin_metadata_url_mentions.js"
import { babelPluginMetadataImportMetaHot } from "./babel_plugin_metadata_import_meta_hot.js"

export const parseJsModuleUrlMentions = async ({ url, urlFacade, content }) => {
  urlFacade = urlFacade || url
  if (urlToExtension(urlFacade) !== ".js") {
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
    url,
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
      const magicString = createMagicString({ content })
      urlMentions.forEach((urlMention) => {
        const replacement = JSON.stringify(transformUrlMention(urlMention))
        const { start, end } = urlMention
        magicString.replace({
          start,
          end,
          replacement,
        })
      })
      return magicString.toContentAndSourcemap()
    },
  }
}
