import { urlToRelativeUrl } from "@jsenv/filesystem"

import { createRessourceGraph } from "@jsenv/core/src/internal/autoreload/ressource_graph.js"

import { javaScriptUrlMentions } from "./js/javascript_url_mentions.js"

const handlers = {
  "application/javascript": javaScriptUrlMentions,
}

export const jsenvPluginUrlMentions = ({ projectDirectoryUrl }) => {
  const ressourceGraph = createRessourceGraph({ projectDirectoryUrl })

  return {
    name: "jsenv:url_mentions",

    appliesDuring: {
      dev: true,
      test: true,
      build: true,
    },

    transform: async ({
      projectDirectoryUrl,
      urlInfoMap,
      resolve,
      url,
      contentType,
      content,
    }) => {
      const handler = handlers[contentType]
      if (!handler) {
        return null
      }
      const { urlMentions, hotDecline, hotAcceptSelf, hotAcceptDependencies } =
        await handler.parse({
          url,
          content,
        })
      await urlMentions.reduce(async (previous, urlMention) => {
        await previous
        const resolvedUrl = await resolve({
          parentUrl: url,
          specifierType: urlMention.type, // 'js_import_meta_url_pattern', 'js_import_export'
          specifier: urlMention.specifier,
        })
        urlMention.url = resolvedUrl
      }, Promise.resolve())

      ressourceGraph.updateRessourceDependencies({
        url,
        type: contentType,
        dependencyUrls: urlMentions.map((urlMention) => urlMention.url),
        hotDecline,
        hotAcceptSelf,
        hotAcceptDependencies,
      })

      const transformReturnValue = await handler.transform({
        url,
        content,
        urlMentions,
        transformUrlMention: (urlMention) => {
          // TODO: inject hmr, version
          const { urlFacade } = urlInfoMap.get(urlMention.url)
          const url = urlFacade || urlMention.url
          if (isValidUrl(url)) {
            return `/${urlToRelativeUrl(url, projectDirectoryUrl)}`
          }
          return url
        },
      })
      return transformReturnValue
    },
  }
}

const isValidUrl = (url) => {
  try {
    // eslint-disable-next-line no-new
    new URL(url)
    return true
  } catch (e) {
    return false
  }
}
