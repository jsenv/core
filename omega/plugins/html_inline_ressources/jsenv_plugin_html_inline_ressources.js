import { urlToFilename } from "@jsenv/filesystem"

import {
  asUrlWithoutSearch,
  injectQueryParams,
} from "#omega/internal/url_utils.js"
import {
  parseHtmlString,
  stringifyHtmlAst,
  findNodes,
  getHtmlNodeTextNode,
  getIdForInlineHtmlNode,
  removeHtmlNodeText,
  assignHtmlNodeAttributes,
  getHtmlNodeLocation,
  parseScriptNode,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"

export const jsenvPluginHtmlInlineRessources = () => {
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
      inlineRessourceMap.set(inlineRessource.url, {
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
    name: "jsenv:html_inline_ressources",

    appliesDuring: {
      dev: true,
      test: true,
      preview: true,
      prod: true,
    },

    load: ({ url }) => {
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

    transform: ({ asClientUrl, url, contentType, content }) => {
      if (contentType !== "text/html") {
        return null
      }
      const htmlAst = parseHtmlString(content)
      const inlineRessources = []
      const scripts = findNodes(content, (node) => node.nodeName === "script")
      scripts.forEach((script) => {
        const textNode = getHtmlNodeTextNode(script)
        if (!textNode) {
          return
        }
        const { line, column } = getHtmlNodeLocation(script)
        const scriptCategory = parseScriptNode(script)
        const inlineScriptId = getIdForInlineHtmlNode(htmlAst, script)
        const inlineScriptSpecifier = `${urlToFilename(url)}#${inlineScriptId}`
        // should we do the following?
        // let inlineScriptUrl = await resolve({
        //   parentUrl: url,
        //   specifierType: 'script_text',
        //   specifier: inlineScriptSpecifier
        // })
        let inlineScriptUrl = new URL(inlineScriptSpecifier, url).href
        if (scriptCategory === "classic") {
          inlineScriptUrl = injectQueryParams(inlineScriptUrl, { script: "" })
        }
        const inlineScriptClientUrl = asClientUrl(inlineScriptUrl, url)
        inlineRessources.push({
          htmlLine: line,
          htmlColumn: column,
          url: inlineScriptClientUrl,
          contentType: "application/javascript",
          content: textNode.value,
        })
        assignHtmlNodeAttributes(script, { src: inlineScriptClientUrl })
        removeHtmlNodeText(script)
      })
      // TODO: <style> tags
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
