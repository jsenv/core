/*
 * Things happening here
 * - html supervisor module injection
 * - scripts are wrapped to be supervised
 *
 * TODO:
 *  - fix url using asClientUrl
 *  - if ressource is referenced by ressource hint we should do sthing?
 *   I think so when we inject ?js_classic
 */

import { injectQueryParams } from "@jsenv/core/src/utils/url_utils.js"
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
} from "@jsenv/core/src/utils/html_ast/html_ast.js"

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
    transform: {
      html: (
        { url, content },
        { rootDirectoryUrl, createReference, resolveReference },
      ) => {
        const htmlAst = parseHtmlString(content)
        const scriptsToSupervise = []
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
          const srcAttribute = getHtmlNodeAttributeByName(node, "src")
          if (!srcAttribute) {
            return
          }
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
        })
        if (scriptsToSupervise.length === 0) {
          return null
        }
        const htmlSupervisorSetupReference = createReference({
          parentUrl: rootDirectoryUrl,
          type: "js_import_export",
          specifier: injectQueryParams(htmlSupervisorSetupFileUrl, {
            js_classic: "",
          }),
        })
        resolveReference(htmlSupervisorSetupReference)
        injectScriptAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            tagName: "script",
            src: htmlSupervisorSetupReference.url,
          }),
        )
        const htmlSupervisorReference = createReference({
          parentUrl: rootDirectoryUrl,
          type: "js_import_export",
          specifier: htmlSupervisorFileUrl,
        })
        resolveReference(htmlSupervisorReference)
        injectScriptAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            tagName: "script",
            type: "module",
            src: htmlSupervisorReference.url,
          }),
        )
        scriptsToSupervise.forEach(
          ({ node, type, src, integrity, crossorigin }) => {
            const scriptReference = createReference({
              parentUrl: url,
              type: "script_src",
              specifier: type === "classic" ? `${src}?js_classic` : src,
            })
            resolveReference(scriptReference)
            removeHtmlNodeAttributeByName(node, "src")
            assignHtmlNodeAttributes(node, {
              "content-src": scriptReference.url,
            })
            setHtmlNodeText(
              node,
              generateCodeToSuperviseScript({
                type,
                src: scriptReference.url,
                integrity,
                crossorigin,
                htmlSupervisorResolvedUrl,
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
  htmlSupervisorResolvedUrl,
}) => {
  const paramsAsJson = JSON.stringify({ src, integrity, crossorigin })
  if (type === "module") {
    return `import { superviseScriptTypeModule } from "${htmlSupervisorResolvedUrl}"
superviseScriptTypeModule(${paramsAsJson})`
  }
  return `window.__html_supervisor__.superviseScript(${paramsAsJson})`
}
