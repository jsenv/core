import { DataUrl } from "@jsenv/core/src/utils/data_url.js"

export const jsenvPluginInlineQueryParam = () => {
  return {
    name: "jsenv:inline_query_param",
    appliesDuring: "*",
    formatReferencedUrl: (reference, { urlGraph, cook }) => {
      if (!new URL(reference.url).searchParams.has("inline")) {
        return null
      }
      return (async () => {
        const urlInfo = urlGraph.getUrlInfo(reference.url)
        await cook({
          reference,
          urlInfo,
        })
        const specifier = DataUrl.stringify({
          mediaType: urlInfo.contentType,
          base64Flag: true,
          data: Buffer.from(urlInfo.content).toString("base64"),
        })
        return specifier
      })()
    },
  }
}
