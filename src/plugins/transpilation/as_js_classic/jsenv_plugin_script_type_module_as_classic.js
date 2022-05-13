import {
  getHtmlNodeAttributeByName,
  getHtmlNodeTextNode,
  parseHtmlString,
  removeHtmlNodeAttributeByName,
  assignHtmlNodeAttributes,
  stringifyHtmlAst,
  visitHtmlAst,
  htmlNodePosition,
  setHtmlNodeGeneratedText,
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
    transformUrlContent: {
      html: async (urlInfo, context) => {
        if (
          context.isSupportedOnCurrentClients("script_type_module") &&
          context.isSupportedOnCurrentClients("import_dynamic")
        ) {
          return null
        }
        const htmlAst = parseHtmlString(urlInfo.content)
        const preloadAsScriptNodes = []
        const modulePreloadNodes = []
        const moduleScriptNodes = []
        const classicScriptNodes = []
        const visitLinkNodes = (node) => {
          if (node.nodeName !== "link") {
            return
          }
          const relAttribute = getHtmlNodeAttributeByName(node, "rel")
          const rel = relAttribute ? relAttribute.value : undefined
          if (rel === "modulepreload") {
            modulePreloadNodes.push(node)
            return
          }
          if (rel === "preload") {
            const asAttribute = getHtmlNodeAttributeByName(node, "as")
            const as = asAttribute ? asAttribute.value : undefined
            if (as === "script") {
              preloadAsScriptNodes.push(node)
            }
            return
          }
        }
        const visitScriptNodes = (node) => {
          if (node.nodeName !== "script") {
            return
          }
          const typeAttribute = getHtmlNodeAttributeByName(node, "type")
          const type = typeAttribute ? typeAttribute.value : undefined
          if (type === "module") {
            moduleScriptNodes.push(node)
            return
          }
          if (type === undefined || type === "text/javascript") {
            classicScriptNodes.push(node)
            return
          }
        }
        visitHtmlAst(htmlAst, (node) => {
          visitLinkNodes(node)
          visitScriptNodes(node)
        })

        const classicScriptUrls = []
        const moduleScriptUrls = []
        classicScriptNodes.forEach((classicScriptNode) => {
          const srcAttribute = getHtmlNodeAttributeByName(
            classicScriptNode,
            "src",
          )
          if (srcAttribute) {
            const url = new URL(srcAttribute.value, urlInfo.url).href
            classicScriptUrls.push(url)
          }
        })
        moduleScriptNodes.forEach((moduleScriptNode) => {
          const srcAttribute = getHtmlNodeAttributeByName(
            moduleScriptNode,
            "src",
          )
          if (srcAttribute) {
            const url = new URL(srcAttribute.value, urlInfo.url).href
            moduleScriptUrls.push(url)
          }
        })

        const jsModuleUrls = []
        const getReferenceAsJsClassic = (reference) => {
          const [newReference, newUrlInfo] = context.referenceUtils.update(
            reference,
            {
              expectedType: "js_classic",
              specifier: injectQueryParamsIntoSpecifier(reference.specifier, {
                as_js_classic: "",
              }),
              filename: generateJsClassicFilename(reference.url),
            },
          )
          const jsModuleUrl = newUrlInfo.url
          if (!jsModuleUrls.includes(jsModuleUrl)) {
            jsModuleUrls.push(newUrlInfo.url)
          }
          return [newReference, newUrlInfo]
        }
        const actions = []
        preloadAsScriptNodes.forEach((preloadAsScriptNode) => {
          const hrefAttribute = getHtmlNodeAttributeByName(
            preloadAsScriptNode,
            "href",
          )
          const href = hrefAttribute.value
          const url = new URL(href, urlInfo.url).href
          const expectedScriptType = moduleScriptUrls.includes(url)
            ? "module"
            : "classic"
          // keep in mind:
          // when the url is not referenced by a <script type="module">
          // we assume we want to preload "classic" but it might not be the case
          // but it's unlikely to happen and people should use "modulepreload" in that case anyway
          if (expectedScriptType === "module") {
            actions.push(() => {
              const [newReference] = getReferenceAsJsClassic(
                context.referenceUtils.findByGeneratedSpecifier(href),
              )
              assignHtmlNodeAttributes(preloadAsScriptNode, {
                href: newReference.generatedSpecifier,
              })
              removeHtmlNodeAttributeByName(preloadAsScriptNode, "crossorigin")
            })
          }
        })
        modulePreloadNodes.forEach((modulePreloadNode) => {
          const hrefAttribute = getHtmlNodeAttributeByName(
            modulePreloadNode,
            "href",
          )
          const href = hrefAttribute.value
          actions.push(() => {
            const [newReference] = getReferenceAsJsClassic(
              context.referenceUtils.findByGeneratedSpecifier(href),
            )
            assignHtmlNodeAttributes(modulePreloadNode, {
              rel: "preload",
              as: "script",
              href: newReference.generatedSpecifier,
            })
          })
        })
        moduleScriptNodes.forEach((moduleScriptNode) => {
          const srcAttribute = getHtmlNodeAttributeByName(
            moduleScriptNode,
            "src",
          )
          if (srcAttribute) {
            actions.push(async () => {
              const specifier = srcAttribute.value
              const [newReference, newUrlInfo] = getReferenceAsJsClassic(
                context.referenceUtils.findByGeneratedSpecifier(specifier),
              )
              removeHtmlNodeAttributeByName(moduleScriptNode, "type")
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
            })
            return
          }
          const textNode = getHtmlNodeTextNode(moduleScriptNode)
          actions.push(async () => {
            const { line, column, lineEnd, columnEnd, isOriginal } =
              htmlNodePosition.readNodePosition(moduleScriptNode, {
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
              node: moduleScriptNode,
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
            const [newReference, newUrlInfo] =
              getReferenceAsJsClassic(inlineReference)
            await context.cook({
              reference: newReference,
              urlInfo: newUrlInfo,
            })
            removeHtmlNodeAttributeByName(moduleScriptNode, "type")
            setHtmlNodeGeneratedText(moduleScriptNode, {
              generatedText: newUrlInfo.content,
              generatedBy: "jsenv:script_type_module_as_classic",
            })
          })
        })

        if (actions.length === 0) {
          return null
        }
        await Promise.all(actions.map((action) => action()))
        if (systemJsInjection) {
          const needsSystemJs = jsModuleUrls.some(
            (jsModuleUrl) =>
              context.urlGraph.getUrlInfo(jsModuleUrl).data.jsClassicFormat ===
              "system",
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
