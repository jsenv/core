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
      html: ({ url, content }, { referenceUtils }) => {
        if (url === toolbarHtmlClientFileUrl) {
          return null
        }
        const htmlAst = parseHtmlString(content)
        const [toolbarInjectorReference] = referenceUtils.inject({
          type: "js_import_export",
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
            "jsenv-plugin-owner": "jsenv:toolbar",
            "tagName": "script",
            "type": "module",
            "textContent": `
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
        )
        const htmlModified = stringifyHtmlAst(htmlAst)
        return {
          content: htmlModified,
        }
      },
    },
  }
}
