/*
 *
 */

import { urlToFilename } from "@jsenv/filesystem"

import { asUrlWithoutSearch } from "#omega/internal/url_utils.js"
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

export const jsenvPluginInlineRessources = () => {
  /**
   * can be represented as below
   * "file:///project_directory/index.html.L10-L12.js": {
   *   "ownerUrl": "file:///project_directory/index.html",
   *   "ownerContent": "console.log(`Hello world`)",
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
    ownerUrl,
    ownerContent,
    inlineRessources,
  }) => {
    inlineRessourceMap.forEach((inlineRessource, inlineRessourceUrl) => {
      if (inlineRessource.ownerUrl === ownerUrl) {
        inlineRessourceMap.delete(inlineRessourceUrl)
      }
    })
    inlineRessources.forEach((inlineRessource) => {
      inlineRessourceMap.set(inlineRessource.url, {
        ...inlineRessource,
        ownerUrl,
        ownerContent,
      })
    })
  }
  // const getInlineUrlSite = (url) => {
  //   const urlWithoutSearch = asUrlWithoutSearch(url)
  //   const inlineRessource = inlineRessourceMap.get(urlWithoutSearch)
  //   return inlineRessource
  //     ? {
  //         url: inlineRessource.ownerUrl,
  //         line: inlineRessource.line,
  //         column: inlineRessource.column,
  //         source: inlineRessource.ownerContent,
  //       }
  //     : null
  // }

  return {
    name: "jsenv:inline_ressources",

    appliesDuring: {
      dev: true,
      test: true,
      preview: true,
      prod: true,
    },

    resolve: ({ projectDirectoryUrl, parentUrl, specifier }) => {
      const url =
        specifier[0] === "/"
          ? new URL(specifier.slice(1), projectDirectoryUrl).href
          : new URL(specifier, parentUrl).href
      const urlWithoutSearch = asUrlWithoutSearch(url)
      if (inlineRessourceMap.has(urlWithoutSearch)) {
        return {
          url,
        }
      }
      return null
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

    transform: async ({ url, contentType, content }) => {
      if (contentType !== "text/html") {
        return null
      }
      const htmlAst = parseHtmlString(content)
      const inlineRessources = []
      const scripts = findNodes(htmlAst, (node) => node.nodeName === "script")
      await scripts.reduce(async (previous, script) => {
        await previous
        const scriptCategory = parseScriptNode(script)
        if (scriptCategory === "importmap") {
          // do not externalize importmap for now
          return
        }
        const textNode = getHtmlNodeTextNode(script)
        if (!textNode) {
          return
        }
        const { line, column } = getHtmlNodeLocation(script)
        const inlineScriptId = getIdForInlineHtmlNode(htmlAst, script)
        let inlineScriptSpecifier = `${urlToFilename(url)}@${inlineScriptId}.js`
        if (scriptCategory === "classic") {
          inlineScriptSpecifier = `${inlineScriptSpecifier}?script`
        }
        const inlineScriptUrl = new URL(inlineScriptSpecifier, url).href
        inlineRessources.push({
          line,
          column,
          url: asUrlWithoutSearch(inlineScriptUrl),
          contentType:
            scriptCategory === "importmap"
              ? "application/importmap+json"
              : "application/javascript",
          content: textNode.value,
        })
        assignHtmlNodeAttributes(script, { src: inlineScriptSpecifier })
        removeHtmlNodeText(script)
      }, Promise.resolve())
      // TODO: <style> tags (that should be turned into <link> tags)
      updateInlineRessources({
        ownerUrl: url,
        ownerContent: content,
        inlineRessources,
      })
      if (inlineRessources.length === 0) {
        return null
      }
      const htmlModified = stringifyHtmlAst(htmlAst)
      return {
        content: htmlModified,
      }
    },
  }
}
