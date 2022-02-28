/*
 * Things happening here
 * - Inline scripts turned into regular ressources
 * - html supervisor module injection
 * - scripts are wrapped to be supervised
 */

import { urlToFilename } from "@jsenv/filesystem"

import {
  asUrlWithoutSearch,
  injectQueryParams,
} from "#omega/internal/url_utils.js"
import {
  parseHtmlString,
  stringifyHtmlAst,
  findNodes,
  getHtmlNodeAttributeByName,
  getHtmlNodeTextNode,
  getIdForInlineHtmlNode,
  removeHtmlNodeAttributeByName,
  setHtmlNodeText,
  assignHtmlNodeAttributes,
  getHtmlNodeLocation,
  parseScriptNode,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"

export const jsenvPluginHtmlSupervisor = () => {
  /**
   * can be represented as below
   * "file:///project_directory/index.html.10.js": {
   *   "htmlUrl": "file:///project_directory/index.html",
   *   "htmlContent": "console.log(`Hello world`)",
   *   "line": 10,
   *   "column": 5,
   *   "contentType": "application/javascript",
   * }
   * It is used to serve inline ressources as if they where inside a file
   * Every time the html file is retransformed, the list of inline ressources inside it
   * are deleted so that when html file and page is reloaded, the inline ressources are updated
   */
  const inlineRessourceMap = new Map()
  const updateInlineRessources = ({
    htmlUrl,
    htmlContent,
    inlineRessources,
  }) => {
    inlineRessourceMap.forEach((inlineRessource, inlineRessourceUrl) => {
      if (inlineRessource.htmlUrl === htmlUrl) {
        inlineRessourceMap.delete(inlineRessourceUrl)
      }
    })
    inlineRessources.forEach((inlineRessource) => {
      const inlineRessourceUrl = asUrlWithoutSearch(
        new URL(inlineRessource.specifier, htmlUrl),
      )
      inlineRessourceMap.set(inlineRessourceUrl, {
        ...inlineRessource,
        htmlUrl,
        htmlContent,
      })
    })
  }
  // const isInlineUrl = (url) => {
  //   const urlWithoutSearch = asUrlWithoutSearch(url)
  //   return inlineRessourceMap.has(urlWithoutSearch)
  // }
  // const getInlineUrlSite = (url) => {
  //   const urlWithoutSearch = asUrlWithoutSearch(url)
  //   const inlineRessource = inlineRessourceMap.get(urlWithoutSearch)
  //   return inlineRessource
  //     ? {
  //         url: inlineRessource.htmlUrl,
  //         line: inlineRessource.htmlLine,
  //         column: inlineRessource.htmlColumn,
  //         source: inlineRessource.htmlContent,
  //       }
  //     : null
  // }

  return {
    name: "jsenv:html_supervisor",

    appliesDuring: {
      dev: true,
      test: true,
      preview: false,
      prod: false,
    },

    load: async ({ url }) => {
      const urlWithoutSearch = asUrlWithoutSearch(url)
      const inlineRessource = inlineRessourceMap.get(urlWithoutSearch)
      if (!inlineRessource) {
        return null
      }
      return {
        contentType: inlineRessource.contentType,
        content: inlineRessource.content,
      }
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
          tagName: "script",
          type: "module",
          src: htmlSupervisorClientUrl,
        }),
      )
      const supervisedScripts = []
      const inlineRessources = []
      await scripts.reduce(async (previous, script) => {
        await previous
        const scriptCategory = parseScriptNode(script)
        const srcAttribute = getHtmlNodeAttributeByName(script, "src")
        if (srcAttribute) {
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
          return
        }
        const textNode = getHtmlNodeTextNode(script)
        if (textNode) {
          const inlineScriptId = getIdForInlineHtmlNode(htmlAst, script)
          let inlineSrc = `/${urlToFilename(url)}#${inlineScriptId}`
          if (scriptCategory === "classic") {
            inlineSrc = injectQueryParams(inlineSrc, { script: "" })
          }
          const { line, column } = getHtmlNodeLocation(script)
          inlineRessources.push({
            htmlLine: line,
            htmlColumn: column,
            specifier: inlineSrc,
            contentType: "application/javascript",
            content: textNode.value,
          })
          supervisedScripts.push({
            script,
            type: scriptCategory,
            textContent: textNode.value,
            inlineSrc,
          })
          assignHtmlNodeAttributes(script, { "content-src": inlineSrc })
          setHtmlNodeText(
            script,
            generateCodeToSuperviseScript({
              type: scriptCategory,
              src: inlineSrc,
              htmlSupervisorFileUrl,
            }),
          )
          return
        }
      }, Promise.resolve())
      updateInlineRessources({
        htmlUrl: url,
        htmlContent: content,
        inlineRessources,
      })
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
