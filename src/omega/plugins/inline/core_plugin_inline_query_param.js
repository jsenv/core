import { DataUrl } from "@jsenv/core/src/utils/data_url.js"

export const corePluginInlineQueryParam = () => {
  return {
    name: "jsenv:inline_query_param",
    appliesDuring: "*",
    formatReferencedUrl: {
      // <link> and <script> can be inlined in the html
      // this should be done during dev and postbuild but not build
      // so that the bundled file gets inlined and not the entry point
      "link_href": () => null,
      "script_src": () => null,
      "*": (reference, { urlGraph, cook }) => {
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
    },
  }
}
