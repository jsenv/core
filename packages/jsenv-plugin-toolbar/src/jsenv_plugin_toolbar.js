import {
  parseHtmlString,
  stringifyHtmlAst,
  injectScriptNodeAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/ast"

export const jsenvPluginToolbar = ({ logs = false } = {}) => {
  const toolbarInjectorClientFileUrl = new URL(
    "./client/toolbar_injector.js",
    import.meta.url,
  ).href
  const toolbarHtmlClientFileUrl = new URL(
    "./client/toolbar.html",
    import.meta.url,
  ).href

  return {
    name: "jsenv:toolbar",
    appliesDuring: "dev",
    transformUrlContent: {
      html: (urlInfo, { referenceUtils }) => {
        urlInfo.data.noribbon = true
        if (urlInfo.url === toolbarHtmlClientFileUrl) {
          return null
        }
        const htmlAst = parseHtmlString(urlInfo.content)
        const [toolbarInjectorReference] = referenceUtils.inject({
          type: "js_import",
          expectedType: "js_module",
          specifier: toolbarInjectorClientFileUrl,
        })
        const [toolbarClientFileReference] = referenceUtils.inject({
          type: "iframe_src",
          expectedType: "html",
          specifier: toolbarHtmlClientFileUrl,
        })
        injectScriptNodeAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            tagName: "script",
            type: "module",
            textContent: `
import { injectToolbar } from ${toolbarInjectorReference.generatedSpecifier}
injectToolbar(${JSON.stringify(
              {
                toolbarUrl: toolbarClientFileReference.generatedSpecifier,
                logs,
              },
              null,
              "  ",
            )})`,
          }),
          "jsenv:toolbar",
        )
        const htmlModified = stringifyHtmlAst(htmlAst)
        return {
          content: htmlModified,
        }
      },
    },
  }
}
