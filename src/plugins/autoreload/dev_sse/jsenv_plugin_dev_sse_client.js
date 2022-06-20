import {
  parseHtmlString,
  stringifyHtmlAst,
  injectScriptNodeAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/ast"

export const jsenvPluginDevSSEClient = () => {
  const eventSourceClientFileUrl = new URL(
    "./client/event_source_client.js",
    import.meta.url,
  ).href

  return {
    name: "jsenv:dev_sse_client",
    appliesDuring: { dev: true },
    transformUrlContent: {
      html: (htmlUrlInfo, context) => {
        const htmlAst = parseHtmlString(htmlUrlInfo.content)
        const [eventSourceClientReference] = context.referenceUtils.inject({
          type: "script_src",
          expectedType: "js_module",
          specifier: eventSourceClientFileUrl,
        })
        injectScriptNodeAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            "tagName": "script",
            "type": "module",
            "src": eventSourceClientReference.generatedSpecifier,
            "injected-by": "jsenv:dev_sse_client",
          }),
        )
        const htmlModified = stringifyHtmlAst(htmlAst)
        return {
          content: htmlModified,
        }
      },
    },
  }
}
