/*
 * Things happening here
 * - html supervisor module injection
 * - scripts are wrapped to be supervised
 */

import { injectQueryParams } from "#omega/internal/url_utils.js"
import {
  parseHtmlString,
  stringifyHtmlAst,
  findNodes,
  getHtmlNodeAttributeByName,
  removeHtmlNodeAttributeByName,
  setHtmlNodeText,
  assignHtmlNodeAttributes,
  parseScriptNode,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"

export const jsenvPluginHtmlSupervisor = () => {
  return {
    name: "jsenv:html_supervisor",

    appliesDuring: {
      dev: true,
      test: true,
      preview: false,
      prod: false,
    },

    transform: async ({
      projectDirectoryUrl,
      resolve,
      asClientUrl,
      url,
      contentType,
      content,
    }) => {
      if (contentType !== "text/html") {
        return null
      }
      const htmlAst = parseHtmlString(content)
      const scripts = findNodes(
        content,
        (node) => node.nodeName === "script",
      ).filter((script) => {
        const dataInjectedAttribute = getHtmlNodeAttributeByName(
          script,
          "data-injected",
        )
        if (dataInjectedAttribute) {
          return false
        }
        const scriptCategory = parseScriptNode(script)
        if (scriptCategory !== "classic" && scriptCategory !== "module") {
          return false
        }
        return true
      })
      if (scripts.length === 0) {
        return null
      }
      const htmlSupervisorFileUrl = await resolve({
        parentUrl: projectDirectoryUrl,
        specifierType: "js_import_export",
        specifier:
          "@jsenv/core/omega/plugins/html_supervisor/supervisor_client/module/html_supervisor_module.js",
      })
      const htmlSupervisorClientUrl = asClientUrl(htmlSupervisorFileUrl, url)
      injectScriptAsEarlyAsPossible(
        htmlAst,
        createHtmlNode({
          "tagName": "script",
          "type": "module",
          "src": htmlSupervisorClientUrl,
          "data-injected": true,
        }),
      )
      const supervisedScripts = []
      await scripts.reduce(async (previous, script) => {
        await previous
        const scriptCategory = parseScriptNode(script)
        const srcAttribute = getHtmlNodeAttributeByName(script, "src")
        if (!srcAttribute) {
          return
        }
        let src = srcAttribute ? srcAttribute.value : undefined
        const integrityAttribute = getHtmlNodeAttributeByName(
          script,
          "integrity",
        )
        const integrity = integrityAttribute
          ? integrityAttribute.value
          : undefined
        const crossoriginAttribute = getHtmlNodeAttributeByName(
          script,
          "crossorigin",
        )
        const crossorigin = crossoriginAttribute
          ? crossoriginAttribute.value
          : undefined
        src = await resolve({
          parentUrl: url,
          specifierType: "script_src",
          specifier: src,
        })
        if (scriptCategory === "classic") {
          src = injectQueryParams(src, { script: "" })
        }
        supervisedScripts.push({
          script,
          type: scriptCategory,
          src,
          integrity,
          crossorigin,
        })
        removeHtmlNodeAttributeByName(script, "src")
        assignHtmlNodeAttributes(script, { "content-src": src })
        setHtmlNodeText(
          script,
          generateCodeToSuperviseScript({
            type: scriptCategory,
            src,
            integrity,
            crossorigin,
            htmlSupervisorClientUrl,
          }),
        )
      }, Promise.resolve())
      const htmlModified = stringifyHtmlAst(htmlAst)
      return {
        content: htmlModified,
      }
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
  htmlSupervisorClientUrl,
}) => {
  const paramsAsJson = JSON.stringify({ src, integrity, crossorigin })
  if (type === "module") {
    return `import { superviseScriptTypeModule } from "${htmlSupervisorClientUrl}"
superviseScriptTypeModule(${paramsAsJson})`
  }
  return `window.__html_supervisor__.superviseScript(${paramsAsJson})`
}
