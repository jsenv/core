import {
  parseHtmlString,
  stringifyHtmlAst,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/utils/html_ast/html_ast.js"

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
    appliesDuring: {
      dev: true,
    },
    transform: {
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
        injectScriptAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
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
            "injected-by": "jsenv:toolbar",
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
