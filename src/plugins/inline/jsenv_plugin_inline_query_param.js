import { DATA_URL } from "@jsenv/urls"

export const jsenvPluginInlineQueryParam = () => {
  return {
    name: "jsenv:inline_query_param",
    appliesDuring: "*",
    formatUrl: {
      // <link> and <script> can be inlined in the html
      // this should be done during dev and postbuild but not build
      // so that the bundled file gets inlined and not the entry point
      "link_href": () => null,
      "style": () => null,
      "script": () => null,
      // if the referenced url is a worker we could use
      // https://www.oreilly.com/library/view/web-workers/9781449322120/ch04.html
      // but maybe we should rather use ?object_url
      // or people could do this:
      // import workerText from './worker.js?text'
      // const blob = new Blob(workerText, { type: 'text/javascript' })
      // window.URL.createObjectURL(blob)
      // in any case the recommended way is to use an url
      // to benefit from shared worker and reuse worker between tabs
      "*": (reference, context) => {
        if (!reference.searchParams.has("inline")) {
          return null
        }
        return (async () => {
          const urlInfo = context.urlGraph.getUrlInfo(reference.url)
          await context.cook(urlInfo, { reference })
          const specifier = DATA_URL.stringify({
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
