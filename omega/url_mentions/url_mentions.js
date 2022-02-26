import { urlToRelativeUrl } from "@jsenv/filesystem"

import { javaScriptUrlMentions } from "./js/javascript_url_mentions.js"

const handlers = {
  "application/javascript": javaScriptUrlMentions,
}

export const transformUrlMentions = async ({
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
  const urlMentions = await handler.parse({
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
  return handler.transform({
    url,
    content,
    urlMentions,
    transformUrlMention: (urlMention) => {
      // TODO: inject hmr, version
      const { facade } = urlInfoMap.get(urlMention.url)
      const url = facade || urlMention.url
      if (isValidUrl(url)) {
        return `/${urlToRelativeUrl(url, projectDirectoryUrl)}`
      }
      return url
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
