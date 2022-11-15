import {
  parseHtmlString,
  stringifyHtmlAst,
  createHtmlNode,
  injectHtmlNode,
} from "@jsenv/ast"
import { URL_META } from "@jsenv/url-meta"
import { asUrlWithoutSearch } from "@jsenv/urls"

export const jsenvPluginRibbon = ({
  rootDirectoryUrl,
  htmlInclude = "/**/*.html",
}) => {
  const ribbonClientFileUrl = new URL("./client/ribbon.js", import.meta.url)
  const associations = URL_META.resolveAssociations(
    {
      ribbon: { [htmlInclude]: true },
    },
    rootDirectoryUrl,
  )
  return {
    name: "jsenv:ribbon",
    appliesDuring: "dev",
    transformUrlContent: {
      html: (urlInfo, context) => {
        const { ribbon } = URL_META.applyAssociations({
          url: asUrlWithoutSearch(urlInfo.url),
          associations,
        })
        if (!ribbon) {
          return null
        }
        const htmlAst = parseHtmlString(urlInfo.content)
        const [ribbonClientFileReference] = context.referenceUtils.inject({
          type: "script_src",
          subtype: "js_module",
          expectedType: "js_module",
          specifier: ribbonClientFileUrl.href,
        })
        const paramsJson = JSON.stringify(
          { text: context.dev ? "DEV" : "BUILD" },
          null,
          "  ",
        )
        const scriptNode = createHtmlNode({
          tagName: "script",
          type: "module",
          textContent: `
import { injectRibbon} from "${ribbonClientFileReference.generatedSpecifier}"

injectRibbon(${paramsJson})`,
        })
        injectHtmlNode(htmlAst, scriptNode, "jsenv:ribbon")
        return stringifyHtmlAst(htmlAst)
      },
    },
  }
}
