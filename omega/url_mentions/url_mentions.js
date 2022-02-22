import { javaScriptUrlMentions } from "./js/javascript_url_mentions.js"

const handlers = {
  "application/javascript": javaScriptUrlMentions,
}

export const transformUrlMentions = async ({
  projectDirectoryUrl,
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
  }, Promise.resolve())
  return handler.transform({
    projectDirectoryUrl,
    url,
    content,
    urlMentions,
  })
}
