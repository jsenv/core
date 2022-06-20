import {
  parseHtmlString,
  stringifyHtmlAst,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/utils/src/html_ast/html_ast.js"

export const jsenvPluginReactRefreshPreamble = () => {
  const reactRefreshPreambleClientFileUrl = new URL(
    "./client/react_refresh_preamble.js",
    import.meta.url,
  ).href

  return {
    name: "jsenv:react_refresh_preamble",
    appliesDuring: { dev: true },
    transformUrlContent: {
      html: (urlInfo, context) => {
        const htmlAst = parseHtmlString(urlInfo.content)
        const [reactRefreshPreambleReference] = context.referenceUtils.inject({
          type: "script_src",
          expectedType: "js_module",
          specifier: reactRefreshPreambleClientFileUrl,
        })
        injectScriptAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            "tagName": "script",
            "type": "module",
            "src": reactRefreshPreambleReference.generatedSpecifier,
            "injected-by": "jsenv:react_refresh_preamble",
          }),
        )
        const htmlModified = stringifyHtmlAst(htmlAst)
        return htmlModified
      },
    },
  }
}
