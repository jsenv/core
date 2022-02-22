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
    const url = await resolve({
      urlSpecifier: urlMention.specifier,
      baseUrl: url,
      type: urlMention.type, // 'url', 'import_export'
    })
    urlMention.url = url
  }, Promise.resolve())
  return handler.transform({
    projectDirectoryUrl,
    url,
    urlMentions,
  })
}
