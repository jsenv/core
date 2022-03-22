/*
 * Things happening here
 * - html supervisor module injection
 * - scripts are wrapped to be supervised
 *
 * TODO:
 *  - if ressource is referenced by ressource hint we should do sthing?
 *   I think so when we inject ?js_classic
 */

import { urlToFilename } from "@jsenv/filesystem"

import {
  injectQueryParams,
  injectQueryParamsIntoSpecifier,
} from "@jsenv/core/src/utils/url_utils.js"
import {
  parseHtmlString,
  stringifyHtmlAst,
  visitHtmlAst,
  getHtmlNodeAttributeByName,
  removeHtmlNodeAttributeByName,
  setHtmlNodeText,
  assignHtmlNodeAttributes,
  parseScriptNode,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
  htmlNodePosition,
  getIdForInlineHtmlNode,
  removeHtmlNodeText,
  getHtmlNodeTextNode,
} from "@jsenv/core/src/utils/html_ast/html_ast.js"
import { stringifyUrlSite } from "@jsenv/core/src/utils/url_trace.js"

export const jsenvPluginHtmlSupervisor = () => {
  const htmlSupervisorSetupFileUrl = new URL(
    "./client/html_supervisor_setup.js",
    import.meta.url,
  ).href
  const htmlSupervisorFileUrl = new URL(
    "./client/html_supervisor.js",
    import.meta.url,
  ).href

  return {
    name: "jsenv:html_supervisor",
    appliesDuring: {
      dev: true,
      test: true,
    },
    load: ({ contentType, originalContent }) => {
      if (!contentType) {
        return null
      }
      return {
        contentType,
        content: originalContent,
      }
    },
    transform: {
      html: ({ url, originalContent, content }, { urlGraph, addReference }) => {
        const htmlAst = parseHtmlString(content)
        const scriptsToSupervise = []

        const addInlineReference = ({
          node,
          type,
          specifier,
          inlineContentType,
          inlineContent,
        }) => {
          const { line, column } = htmlNodePosition.readNodePosition(node, {
            preferOriginal: true,
          })
          const inlineReference = addReference({
            trace: stringifyUrlSite({
              url,
              content: originalContent,
              line,
              column,
            }),
            type,
            specifier,
          })
          const inlineUrlInfo = urlGraph.getUrlInfo(inlineReference.url)
          inlineUrlInfo.contentType = inlineContentType
          inlineUrlInfo.originalContent = inlineContent
          inlineUrlInfo.inlineUrlSite = {
            url,
            content: originalContent, // original because it's the origin line and column
            // we remove 1 to the line because imagine the following html:
            // <script>console.log('ok')</script>
            // -> code starts at the same line than script tag
            line: line - 1,
            column,
          }
          return inlineReference
        }

        const handleInlineScript = (node, textNode) => {
          const scriptCategory = parseScriptNode(node)
          const inlineScriptId = getIdForInlineHtmlNode(htmlAst, node)
          const inlineScriptSpecifier = `${urlToFilename(
            url,
          )}@${inlineScriptId}.js`
          const inlineScriptReference = addInlineReference({
            node,
            type: "script_src",
            specifier:
              scriptCategory === "classic"
                ? injectQueryParamsIntoSpecifier(inlineScriptSpecifier, {
                    js_classic: "",
                  })
                : inlineScriptSpecifier,
            inlineContentType: "application/javascript",
            inlineContent: textNode.value,
          })
          assignHtmlNodeAttributes(node, {
            "src": inlineScriptReference.generatedSpecifier,
            "data-externalized": "",
          })
          removeHtmlNodeText(node)
        }
        const handleScriptWithSrc = (node, srcAttribute) => {
          const scriptCategory = parseScriptNode(node)
          let src = srcAttribute ? srcAttribute.value : undefined
          const integrityAttribute = getHtmlNodeAttributeByName(
            node,
            "integrity",
          )
          const integrity = integrityAttribute
            ? integrityAttribute.value
            : undefined
          const crossoriginAttribute = getHtmlNodeAttributeByName(
            node,
            "crossorigin",
          )
          const crossorigin = crossoriginAttribute
            ? crossoriginAttribute.value
            : undefined
          scriptsToSupervise.push({
            node,
            type: scriptCategory,
            src,
            integrity,
            crossorigin,
          })
        }

        visitHtmlAst(htmlAst, (node) => {
          if (node.nodeName !== "script") {
            return
          }
          const scriptCategory = parseScriptNode(node)
          if (scriptCategory !== "classic" && scriptCategory !== "module") {
            return
          }
          const dataInjectedAttribute = getHtmlNodeAttributeByName(
            node,
            "data-injected",
          )
          if (dataInjectedAttribute) {
            return
          }
          const textNode = getHtmlNodeTextNode(node)
          if (textNode) {
            handleInlineScript(node)
            return
          }
          const srcAttribute = getHtmlNodeAttributeByName(node, "src")
          if (srcAttribute) {
            handleScriptWithSrc(node)
            return
          }
        })
        if (scriptsToSupervise.length === 0) {
          return null
        }
        const htmlSupervisorSetupFileReference = addReference({
          type: "js_import_export",
          specifier: injectQueryParams(htmlSupervisorSetupFileUrl, {
            js_classic: "",
          }),
        })
        injectScriptAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            tagName: "script",
            src: htmlSupervisorSetupFileReference.generatedSpecifier,
          }),
        )
        const htmlSupervisorFileReference = addReference({
          type: "js_import_export",
          specifier: htmlSupervisorFileUrl,
        })
        injectScriptAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            tagName: "script",
            type: "module",
            src: htmlSupervisorFileReference.generatedSpecifier,
          }),
        )
        scriptsToSupervise.forEach(
          ({ node, type, src, integrity, crossorigin }) => {
            removeHtmlNodeAttributeByName(node, "src")
            assignHtmlNodeAttributes(node, {
              "content-src": src,
            })
            setHtmlNodeText(
              node,
              generateCodeToSuperviseScript({
                type,
                src,
                integrity,
                crossorigin,
                htmlSupervisorSpecifier:
                  htmlSupervisorFileReference.generatedSpecifier,
              }),
            )
          },
        )
        const htmlModified = stringifyHtmlAst(htmlAst)
        return {
          content: htmlModified,
        }
      },
    },
  }
}

// Ideally jsenv should take into account eventual
// "integrity" and "crossorigin" attribute during supervision
const generateCodeToSuperviseScript = ({
  type,
  src,
  integrity,
  crossorigin,
  htmlSupervisorSpecifier,
}) => {
  const paramsAsJson = JSON.stringify({ src, integrity, crossorigin })
  if (type === "module") {
    return `import { superviseScriptTypeModule } from "${htmlSupervisorSpecifier}"
superviseScriptTypeModule(${paramsAsJson})`
  }
  return `window.__html_supervisor__.superviseScript(${paramsAsJson})`
}
