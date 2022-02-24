import { urlToRelativeUrl } from "@jsenv/filesystem"

import { javaScriptUrlMentions } from "./js/javascript_url_mentions.js"

const handlers = {
  "application/javascript": javaScriptUrlMentions,
}

export const transformUrlMentions = async ({
  projectDirectoryUrl,
  urlFacadeMappings,
  resolve,
  url,
  contentType,
  content,
}) => {
  const handler = handlers[contentType]
  if (!handler) {
    return null
  }
  const urlMentions = await handler.parse({
    url,
    content,
  })
  await urlMentions.reduce(async (previous, urlMention) => {
    await previous
    const resolvedUrl = await resolve({
      urlResolutionMethod: urlMention.type, // 'url', 'import_export'
      urlSpecifier: urlMention.specifier,
      baseUrl: url,
    })
    urlMention.url = resolvedUrl
    urlMention.urlFacade =
      facadeUrlFromUrl(resolvedUrl, urlFacadeMappings) || resolvedUrl
  }, Promise.resolve())
  return handler.transform({
    url,
    content,
    urlMentions,
    transformUrlMention: (urlMention) => {
      // TODO: inject hmr if needed
      const { urlFacade } = urlMention
      if (isValidUrl(urlFacade)) {
        return `/${urlToRelativeUrl(urlFacade, projectDirectoryUrl)}`
      }
      return urlFacade
    },
  })
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

const facadeUrlFromUrl = (url, urlFacadeMappings) => {
  const keyFound = Object.keys(urlFacadeMappings).find(
    (key) => urlFacadeMappings[key] === url,
  )
  return keyFound ? urlFacadeMappings[keyFound] : null
}
