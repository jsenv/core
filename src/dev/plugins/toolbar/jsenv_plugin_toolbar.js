import {
  parseHtmlString,
  stringifyHtmlAst,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/core/src/utils/html_ast/html_ast.js"

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
      html: ({ url, content }, { addReference }) => {
        if (url === toolbarHtmlClientFileUrl) {
          return null
        }
        const htmlAst = parseHtmlString(content)
        const toolbarInjectorReference = addReference({
          type: "js_import_export",
          specifier: toolbarInjectorClientFileUrl,
        })
        const toolbarClientFileReference = addReference({
          type: "iframe_src",
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
