import { urlToExtension } from "@jsenv/filesystem"

import { babelTransform } from "@jsenv/core/src/internal/transform_js/babel_transform.js"
import { createMagicSource } from "#omega/internal/sourcemap/magic_source.js"

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
    transformUrlMentions: ({ transformUrlMention }) => {
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
}
