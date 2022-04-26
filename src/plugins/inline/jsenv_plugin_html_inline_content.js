import {
  parseHtmlString,
  stringifyHtmlAst,
  visitHtmlAst,
  getHtmlNodeTextNode,
  htmlNodePosition,
  parseScriptNode,
  setHtmlNodeGeneratedText,
  getHtmlNodeAttributeByName,
} from "@jsenv/utils/html_ast/html_ast.js"
import { generateInlineContentUrl } from "@jsenv/utils/urls/inline_content_url_generator.js"
import { CONTENT_TYPE } from "@jsenv/utils/content_type/content_type.js"

export const jsenvPluginHtmlInlineContent = ({ analyzeConvertedScripts }) => {
  return {
    name: "jsenv:html_inline_content",
    appliesDuring: "*",
    transform: {
      html: async (urlInfo, context) => {
        const htmlAst = parseHtmlString(urlInfo.content)
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
              url: urlInfo.url,
              extension: ".css",
              line,
              column,
              lineEnd,
              columnEnd,
            })
            const [inlineStyleReference, inlineStyleUrlInfo] =
              context.referenceUtils.foundInline({
                type: "link_href",
                expectedType: "css",
                // we remove 1 to the line because imagine the following html:
                // <style>body { color: red; }</style>
                // -> content starts same line as <style>
                line: line - 1,
                column,
                isOriginalPosition: isOriginal,
                specifier: inlineStyleUrl,
                contentType: "text/css",
                content: textNode.value,
              })
            await context.cook({
              reference: inlineStyleReference,
              urlInfo: inlineStyleUrlInfo,
            })
            setHtmlNodeGeneratedText(node, {
              generatedText: inlineStyleUrlInfo.content,
              generatedBy: "jsenv:html_inline_content",
            })
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
          if (!analyzeConvertedScripts) {
            // If the inline script was already handled by an other plugin, ignore it
            // In practice we want to avoid cooking twice a script during build
            const generatedBy = getHtmlNodeAttributeByName(node, "generated-by")
            if (
              generatedBy &&
              generatedBy.value === "jsenv:script_type_module_as_classic"
            ) {
              return
            }
          }
          actions.push(async () => {
            const scriptCategory = parseScriptNode(node)
            const { line, column, lineEnd, columnEnd, isOriginal } =
              htmlNodePosition.readNodePosition(node, {
                preferOriginal: true,
              })
            // from MDN about [type] attribute:
            // "Any other value: The embedded content is treated as a data block
            // which won't be processed by the browser. Developers must use a valid MIME type
            // that is not a JavaScript MIME type to denote data blocks.
            // The src attribute will be ignored."
            // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#attr-type
            const isJs =
              scriptCategory === "classic" || scriptCategory === "module"
            const isImportmap = scriptCategory === "importmap"
            const contentType = isJs
              ? "text/javascript"
              : isImportmap
              ? "application/importmap+json"
              : scriptCategory

            let inlineScriptUrl = generateInlineContentUrl({
              url: urlInfo.url,
              extension: CONTENT_TYPE.asFileExtension(contentType),
              line,
              column,
              lineEnd,
              columnEnd,
            })
            const [inlineScriptReference, inlineScriptUrlInfo] =
              context.referenceUtils.foundInline({
                node,
                type: "script_src",
                expectedType: {
                  classic: "js_classic",
                  module: "js_module",
                  importmap: "importmap",
                }[scriptCategory],
                // we remove 1 to the line because imagine the following html:
                // <script>console.log('ok')</script>
                // -> content starts same line as <script>
                line: line - 1,
                column,
                isOriginalPosition: isOriginal,
                specifier: inlineScriptUrl,
                contentType,
                content: textNode.value,
              })

            await context.cook({
              reference: inlineScriptReference,
              urlInfo: inlineScriptUrlInfo,
            })
            setHtmlNodeGeneratedText(node, {
              generatedText: inlineScriptUrlInfo.content,
              generatedBy: "jsenv:html_inline_content",
            })
          })
        }
        visitHtmlAst(htmlAst, (node) => {
          handleInlineStyle(node)
          handleInlineScript(node)
        })
        if (actions.length === 0) {
          return null
        }
        await Promise.all(actions.map((action) => action()))
        const htmlModified = stringifyHtmlAst(htmlAst)
        return {
          content: htmlModified,
        }
      },
    },
  }
}
