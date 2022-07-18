import {
  parseHtmlString,
  stringifyHtmlAst,
  injectScriptNodeAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/ast"

export const jsenvPluginAutoreloadClient = () => {
  const autoreloadClientFileUrl = new URL(
    "./client/autoreload.js",
    import.meta.url,
  ).href

  return {
    name: "jsenv:autoreload_client",
    appliesDuring: { dev: true },
    transformUrlContent: {
      html: (htmlUrlInfo, context) => {
        const htmlAst = parseHtmlString(htmlUrlInfo.content)
        const [autoreloadClientReference] = context.referenceUtils.inject({
          type: "script_src",
          expectedType: "js_module",
          specifier: autoreloadClientFileUrl,
        })
        injectScriptNodeAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            "tagName": "script",
            "type": "module",
            "src": autoreloadClientReference.generatedSpecifier,
            "injected-by": "jsenv:autoreload_client",
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
