import { DataUrl } from "@jsenv/core/src/utils/data_url.js"

export const jsenvPluginInlineQueryParam = () => {
  return {
    name: "jsenv:inline_query_param",
    appliesDuring: "*",
    formatReferencedUrl: {
      // <link> and <script> can be inlined in the html
      // this should be done during dev and postbuild but not build
      // so that the bundled file gets inlined and not the entry point
      "link_href": () => null,
      "script_src": () => null,
      // if the referenced url is a worker we could use
      // https://www.oreilly.com/library/view/web-workers/9781449322120/ch04.html
      // but maybe we should rather use ?object_url
      // or people could do this:
      // import workerText from './worker.js?text'
      // const blob = new Blob(workerText, { type: 'application/javascript' })
      // window.URL.createObjectURL(blob)
      // in any case the recommended way is to use an url
      // to benefit from shared worker and reuse worker between tabs
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
