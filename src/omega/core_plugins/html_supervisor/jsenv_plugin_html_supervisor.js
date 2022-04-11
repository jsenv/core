/*
 * Things happening here
 * - html supervisor module injection
 * - scripts are wrapped to be supervised
 *
 * TODO:
 *  - if ressource is referenced by ressource hint we should do sthing?
 *   I think so when we inject ?js_classic
 */

import { injectQueryParams } from "@jsenv/utils/urls/url_utils.js"
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
  removeHtmlNodeText,
  getHtmlNodeTextNode,
} from "@jsenv/utils/html_ast/html_ast.js"
import { generateInlineContentUrl } from "@jsenv/utils/urls/inline_content_url_generator.js"

export const jsenvPluginHtmlSupervisor = ({
  logs = false,
  measurePerf = false,
} = {}) => {
  const htmlSupervisorSetupFileUrl = new URL(
    "./client/html_supervisor_setup.js",
    import.meta.url,
  ).href
  const htmlSupervisorInstallerFileUrl = new URL(
    "./client/html_supervisor_installer.js",
    import.meta.url,
  ).href

  return {
    name: "jsenv:html_supervisor",
    appliesDuring: {
      dev: true,
      test: true,
    },
    transform: {
      html: ({ url, content }, { referenceUtils }) => {
        const htmlAst = parseHtmlString(content)
        const scriptsToSupervise = []

        const handleInlineScript = (node, textNode) => {
          const scriptCategory = parseScriptNode(node)
          const { line, column, lineEnd, columnEnd, isOriginal } =
            htmlNodePosition.readNodePosition(node, {
              preferOriginal: true,
            })
          let inlineScriptUrl = generateInlineContentUrl({
            url,
            extension: ".js",
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
          const [inlineScriptReference] = referenceUtils.foundInline({
            type: "script_src",
            line: line - 1,
            column,
            isOriginal,
            specifier: inlineScriptUrl,
            contentType: "application/javascript",
            content: textNode.value,
          })
          assignHtmlNodeAttributes(node, {
            "src": inlineScriptReference.generatedSpecifier,
            "src-generated-from-inline-content": "",
          })
          removeHtmlNodeText(node)
          scriptsToSupervise.push({
            node,
            type: scriptCategory,
            src: inlineScriptReference.generatedSpecifier,
          })
        }
        const handleScriptWithSrc = (node, srcAttribute) => {
          const scriptCategory = parseScriptNode(node)
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
            src: srcAttribute.value,
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
          const injectedByAttribute = getHtmlNodeAttributeByName(
            node,
            "injected-by",
          )
          if (injectedByAttribute) {
            return
          }
          const noHtmlSupervisor = getHtmlNodeAttributeByName(
            node,
            "no-html-supervisor",
          )
          if (noHtmlSupervisor) {
            return
          }
          const textNode = getHtmlNodeTextNode(node)
          if (textNode) {
            handleInlineScript(node, textNode)
            return
          }
          const srcAttribute = getHtmlNodeAttributeByName(node, "src")
          if (srcAttribute) {
            handleScriptWithSrc(node, srcAttribute)
            return
          }
        })
        if (scriptsToSupervise.length === 0) {
          return null
        }
        const [htmlSupervisorInstallerFileReference] = referenceUtils.inject({
          type: "js_import_export",
          specifier: htmlSupervisorInstallerFileUrl,
        })
        injectScriptAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            "tagName": "script",
            "type": "module",
            "textContent": `
import { installHtmlSupervisor } from ${
              htmlSupervisorInstallerFileReference.generatedSpecifier
            }
installHtmlSupervisor(${JSON.stringify(
              {
                logs,
                measurePerf,
              },
              null,
              "  ",
            )})`,
            "injected-by": "jsenv:html_supervisor",
          }),
        )
        const [htmlSupervisorSetupFileReference] = referenceUtils.inject({
          type: "script_src",
          specifier: injectQueryParams(htmlSupervisorSetupFileUrl, {
            js_classic: "",
          }),
        })
        injectScriptAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            "tagName": "script",
            "src": htmlSupervisorSetupFileReference.generatedSpecifier,
            "injected-by": "jsenv:html_supervisor",
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
                htmlSupervisorInstallerSpecifier:
                  htmlSupervisorInstallerFileReference.generatedSpecifier,
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
  htmlSupervisorInstallerSpecifier,
}) => {
  const paramsAsJson = JSON.stringify({ src, integrity, crossorigin })
  if (type === "module") {
    return `import { superviseScriptTypeModule } from ${htmlSupervisorInstallerSpecifier}
superviseScriptTypeModule(${paramsAsJson})`
  }
  return `window.__html_supervisor__.superviseScript(${paramsAsJson})`
}
