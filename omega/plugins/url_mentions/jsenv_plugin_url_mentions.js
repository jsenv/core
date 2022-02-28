import { findAsync } from "#omega/internal/find_async.js"

import { parseHtmlUrlMentions } from "./html/html_url_mentions.js"
import { parseCssUrlMentions } from "./css/css_url_mentions.js"
import { parseJsModuleUrlMentions } from "./js_module/js_module_url_mentions.js"

const urlMentionParsers = [
  parseHtmlUrlMentions,
  parseCssUrlMentions,
  parseJsModuleUrlMentions,
]

export const jsenvPluginUrlMentions = () => {
  return {
    name: "jsenv:url_mentions",

    appliesDuring: {
      dev: true,
      test: true,
      preview: true,
      prod: true,
    },

    transform: async ({
      ressourceGraph,
      resolve,
      asClientUrl,
      url,
      urlFacade,
      contentType,
      content,
    }) => {
      const parseReturnValue = await findAsync({
        array: urlMentionParsers,
        start: (urlMentionParser) => {
          return urlMentionParser({
            url,
            urlFacade,
            contentType,
            content,
          })
        },
        predicate: (returnValue) => Boolean(returnValue),
      })
      if (!parseReturnValue) {
        return null
      }
      const { urlMentions, getHotInfo, transformUrlMentions } = parseReturnValue
      await urlMentions.reduce(async (previous, urlMention) => {
        await previous
        const resolvedUrl = await resolve({
          parentUrl: url,
          specifierType: urlMention.type, // 'js_import_meta_url_pattern', 'js_import_export'
          specifier: urlMention.specifier,
        })
        urlMention.url = resolvedUrl
      }, Promise.resolve())
      const {
        hotDecline = false,
        hotAcceptSelf = false,
        hotAcceptDependencies = [],
      } = getHotInfo()
      ressourceGraph.updateRessourceDependencies({
        url,
        type: contentType,
        dependencyUrls: urlMentions.map((urlMention) => urlMention.url),
        hotDecline,
        hotAcceptSelf,
        hotAcceptDependencies,
      })
      const hmr = new URL(url).searchParams.get("hmr")
      const transformReturnValue = await transformUrlMentions({
        transformUrlMention: (urlMention) => {
          const clientUrl = asClientUrl(urlMention.url, { hmr })
          return clientUrl
        },
      })
      return transformReturnValue
    },
  }
}
