import {
  parseHtmlString,
  stringifyHtmlAst,
  injectScriptNodeAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/ast"

export const jsenvPluginToolbar = ({
  logLevel = "warn",
  theme = "dark",
  opened = false,
  animationsEnabled = false,
  notificationsEnabled = true,
} = {}) => {
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
      html: (urlInfo, context) => {
        urlInfo.data.noribbon = true
        if (urlInfo.url === toolbarHtmlClientFileUrl) {
          return null
        }
        const htmlAst = parseHtmlString(urlInfo.content)
        const [toolbarInjectorReference] = context.referenceUtils.inject({
          type: "js_import",
          expectedType: "js_module",
          specifier: toolbarInjectorClientFileUrl,
        })
        const [toolbarClientFileReference] = context.referenceUtils.inject({
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
                logLevel,
                theme,
                opened,
                animationsEnabled,
                notificationsEnabled,
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
