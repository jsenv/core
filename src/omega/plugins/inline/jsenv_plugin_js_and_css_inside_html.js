import {
  parseHtmlString,
  stringifyHtmlAst,
  visitHtmlAst,
  getHtmlNodeTextNode,
  htmlNodePosition,
  parseScriptNode,
  setHtmlNodeText,
  getHtmlNodeAttributeByName,
} from "@jsenv/utils/html_ast/html_ast.js"
import { injectQueryParams } from "@jsenv/utils/urls/url_utils.js"
import { generateInlineContentUrl } from "@jsenv/core/packages/utils/urls/inline_content_url_generator.js"

export const jsenvPluginJsAndCssInsideHtml = () => {
  return {
    name: "jsenv:js_and_css_inside_html",
    appliesDuring: "*",
    transform: {
      html: async ({ url, content }, { cook, referenceUtils }) => {
        const htmlAst = parseHtmlString(content)
        const actions = []
        const handleInlineStyle = (node) => {
          if (node.nodeName !== "style") {
            return
          }
          const textNode = getHtmlNodeTextNode(node)
          if (!textNode) {
            return
          }
          actions.push(async () => {
            const { line, column, lineEnd, columnEnd, isOriginal } =
              htmlNodePosition.readNodePosition(node, {
                preferOriginal: true,
              })
            const inlineStyleUrl = generateInlineContentUrl({
              url,
              extension: ".css",
              line,
              column,
              lineEnd,
              columnEnd,
            })
            const [inlineStyleReference, inlineStyleUrlInfo] =
              referenceUtils.foundInline({
                type: "link_href",
                // we remove 1 to the line because imagine the following html:
                // <style>body { color: red; }</style>
                // -> content starts same line as <style>
                line: line - 1,
                column,
                isOriginal,
                specifier: inlineStyleUrl,
                contentType: "text/css",
                content: textNode.value,
              })
            await cook({
              reference: inlineStyleReference,
              urlInfo: inlineStyleUrlInfo,
            })
            setHtmlNodeText(node, inlineStyleUrlInfo.content)
          })
        }
        const handleInlineScript = (node) => {
          if (node.nodeName !== "script") {
            return
          }
          const textNode = getHtmlNodeTextNode(node)
          if (!textNode) {
            return
          }
          const contentSrc = getHtmlNodeAttributeByName(node, "content-src")
          if (contentSrc) {
            // it's inline but there is a corresponding "src" somewhere
            // - for instance the importmap was inlined by importmap plugin
            //   in that case the content is already cooked and can be kept as it is
            // - any other logic that would turn a remote script into some content
            //   but don't want to cook the content
            return
          }
          actions.push(async () => {
            const scriptCategory = parseScriptNode(node)
            const { line, column, lineEnd, columnEnd, isOriginal } =
              htmlNodePosition.readNodePosition(node, {
                preferOriginal: true,
              })
            let inlineScriptUrl = generateInlineContentUrl({
              url,
              extension: scriptCategory === "importmap" ? ".importmap" : ".js",
              line,
              column,
              lineEnd,
              columnEnd,
            })
            if (scriptCategory === "classic") {
              inlineScriptUrl = injectQueryParams(inlineScriptUrl, {
                js_classic: "",
              })
            }
            const [inlineScriptReference, inlineScriptUrlInfo] =
              referenceUtils.foundInline({
                node,
                type: "script_src",
                // we remove 1 to the line because imagine the following html:
                // <script>console.log('ok')</script>
                // -> content starts same line as <script>
                line: line - 1,
                column,
                isOriginal,
                specifier: inlineScriptUrl,
                contentType:
                  scriptCategory === "importmap"
                    ? "application/importmap+json"
                    : "application/javascript",
                content: textNode.value,
              })
            await cook({
              reference: inlineScriptReference,
              urlInfo: inlineScriptUrlInfo,
            })
            setHtmlNodeText(node, inlineScriptUrlInfo.content)
          })
        }
        visitHtmlAst(htmlAst, (node) => {
          handleInlineStyle(node)
          handleInlineScript(node)
        })
        if (actions.length === 0) {
          return null
        }
        await Promise.all(
          actions.map(async (action) => {
            await action()
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
