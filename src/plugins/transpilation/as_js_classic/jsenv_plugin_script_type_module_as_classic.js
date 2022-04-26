import {
  getHtmlNodeAttributeByName,
  getHtmlNodeTextNode,
  parseHtmlString,
  removeHtmlNodeAttribute,
  stringifyHtmlAst,
  visitHtmlAst,
  htmlNodePosition,
  setHtmlNodeText,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/utils/html_ast/html_ast.js"
import { generateInlineContentUrl } from "@jsenv/utils/urls/inline_content_url_generator.js"
import { injectQueryParamsIntoSpecifier } from "@jsenv/utils/urls/url_utils.js"

export const jsenvPluginScriptTypeModuleAsClassic = ({
  systemJsInjection,
  systemJsClientFileUrl,
  generateJsClassicFilename,
}) => {
  return {
    name: "jsenv:script_type_module_as_classic",
    appliesDuring: "*",
    transform: {
      html: async (urlInfo, context) => {
        if (
          context.isSupportedOnCurrentClients("script_type_module") &&
          context.isSupportedOnCurrentClients("import_dynamic")
        ) {
          return null
        }
        const htmlAst = parseHtmlString(urlInfo.content)
        const actions = []
        const jsModuleUrlInfos = []
        const visitScriptTypeModule = (node) => {
          if (node.nodeName !== "script") {
            return
          }
          const typeAttribute = getHtmlNodeAttributeByName(node, "type")
          if (!typeAttribute || typeAttribute.value !== "module") {
            return
          }
          const srcAttribute = getHtmlNodeAttributeByName(node, "src")
          if (srcAttribute) {
            actions.push(async () => {
              const specifier = srcAttribute.value
              const reference =
                context.referenceUtils.findByGeneratedSpecifier(specifier)
              const [newReference, newUrlInfo] = context.referenceUtils.update(
                reference,
                {
                  expectedType: "js_classic",
                  specifier: injectQueryParamsIntoSpecifier(specifier, {
                    as_js_classic: "",
                  }),
                  filename: generateJsClassicFilename(reference.url),
                },
              )
              removeHtmlNodeAttribute(node, typeAttribute)
              srcAttribute.value = newReference.generatedSpecifier
              // during dev it means js modules will be cooked before server sends the HTML
              // it's ok because:
              // - during dev script_type_module are supported (dev use a recent browser)
              // - even if browser is not supported it still works it's jus a bit slower
              //   because it needs to decide if systemjs will be injected or not
              await context.cook({
                reference: newReference,
                urlInfo: newUrlInfo,
              })
              jsModuleUrlInfos.push(newUrlInfo)
            })
            return
          }
          const textNode = getHtmlNodeTextNode(node)
          actions.push(async () => {
            const { line, column, lineEnd, columnEnd, isOriginal } =
              htmlNodePosition.readNodePosition(node, {
                preferOriginal: true,
              })
            let inlineScriptUrl = generateInlineContentUrl({
              url: urlInfo.url,
              extension: ".js",
              line,
              column,
              lineEnd,
              columnEnd,
            })
            const [inlineReference] = context.referenceUtils.foundInline({
              node,
              type: "script_src",
              expectedType: "js_module",
              // we remove 1 to the line because imagine the following html:
              // <script>console.log('ok')</script>
              // -> content starts same line as <script>
              line: line - 1,
              column,
              isOriginalPosition: isOriginal,
              specifier: inlineScriptUrl,
              contentType: "application/javascript",
              content: textNode.value,
            })
            const [newReference, newUrlInfo] = context.referenceUtils.update(
              inlineReference,
              {
                expectedType: "js_classic",
                specifier: injectQueryParamsIntoSpecifier(inlineScriptUrl, {
                  as_js_classic: "",
                }),
                filename: generateJsClassicFilename(inlineReference.url),
              },
            )
            await context.cook({
              reference: newReference,
              urlInfo: newUrlInfo,
            })
            removeHtmlNodeAttribute(node, typeAttribute)
            setHtmlNodeText(node, newUrlInfo.content)
            jsModuleUrlInfos.push(newUrlInfo)
          })
        }
        visitHtmlAst(htmlAst, (node) => {
          visitScriptTypeModule(node)
        })
        if (actions.length === 0) {
          return null
        }
        await Promise.all(actions.map((action) => action()))
        if (systemJsInjection) {
          const needsSystemJs = jsModuleUrlInfos.some(
            (jsModuleUrlInfo) =>
              jsModuleUrlInfo.data.jsClassicFormat === "system",
          )
          if (needsSystemJs) {
            const [systemJsReference] = context.referenceUtils.inject({
              type: "script_src",
              expectedType: "js_classic",
              specifier: systemJsClientFileUrl,
            })
            injectScriptAsEarlyAsPossible(
              htmlAst,
              createHtmlNode({
                "tagName": "script",
                "src": systemJsReference.generatedSpecifier,
                "injected-by": "jsenv:script_type_module_as_classic",
              }),
            )
          }
        }
        return stringifyHtmlAst(htmlAst)
      },
    },
  }
}
