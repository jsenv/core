import {
  parseHtmlString,
  stringifyHtmlAst,
  injectScriptNodeAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/ast"

export const jsenvPluginReactRefreshPreamble = () => {
  const reactRefreshPreambleClientFileUrl = new URL(
    "./client/react_refresh_preamble.js",
    import.meta.url,
  ).href

  return {
    name: "jsenv:react_refresh_preamble",
    appliesDuring: "dev",
    transformUrlContent: {
      html: (urlInfo, context) => {
        const htmlAst = parseHtmlString(urlInfo.content)
        const [reactRefreshPreambleReference] = context.referenceUtils.inject({
          type: "script_src",
          expectedType: "js_module",
          specifier: reactRefreshPreambleClientFileUrl,
        })
        injectScriptNodeAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            "jsenv-plugin-owner": "jsenv:react_refresh_preamble",
            "tagName": "script",
            "type": "module",
            "src": reactRefreshPreambleReference.generatedSpecifier,
          }),
        )
        const htmlModified = stringifyHtmlAst(htmlAst)
        return htmlModified
      },
    },
  }
}
