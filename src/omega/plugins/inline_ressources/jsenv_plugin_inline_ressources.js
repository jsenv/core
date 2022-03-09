/*
 *
 */

import { urlToFilename } from "@jsenv/filesystem"

import {
  parseHtmlString,
  stringifyHtmlAst,
  visitHtmlAst,
  getHtmlNodeTextNode,
  getIdForInlineHtmlNode,
  removeHtmlNodeText,
  assignHtmlNodeAttributes,
  htmlNodePosition,
  parseScriptNode,
} from "@jsenv/core/src/utils/html_ast/html_ast.js"

export const jsenvPluginInlineRessources = () => {
  /**
   * can be represented as below
   * "file:///project_directory/index.html.L10-L12.js": {
   *   "ownerUrl": "file:///project_directory/index.html",
   *   "ownerContent": "<html><script>console.log(`Hello world`)</script></html>",
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
  const tryResolveInline = ({ parentUrl, specifier }) => {
    const url = new URL(specifier, parentUrl).href
    if (inlineRessourceMap.has(url)) {
      return url
    }
    return null
  }

  return {
    name: "jsenv:inline_ressources",
    appliesDuring: "*",
    resolve: {
      script_src: tryResolveInline,
      link_href: tryResolveInline,
    },
    load: ({ url }) => {
      const inlineRessource = inlineRessourceMap.get(url)
      if (!inlineRessource) {
        return null
      }
      return {
        contentType: inlineRessource.contentType,
        content: inlineRessource.content,
      }
    },
    deriveMetaFromUrl: ({ url }) => {
      const inlineRessource = inlineRessourceMap.get(url)
      if (!inlineRessource) {
        return null
      }
      return {
        ownerUrl: inlineRessource.ownerUrl,
        ownerLine: inlineRessource.line,
        ownerColumn: inlineRessource.column,
        ownerContent: inlineRessource.ownerContent,
      }
    },
    transform: {
      html: async ({ url, originalContent, content }) => {
        const htmlAst = parseHtmlString(content)
        const inlineRessources = []
        const handleInlineStyle = (node) => {
          if (node.nodeName !== "style") {
            return
          }
          const textNode = getHtmlNodeTextNode(node)
          if (!textNode) {
            return
          }
          const { line, column } = htmlNodePosition.readNodePosition(node)
          const inlineStyleId = getIdForInlineHtmlNode(htmlAst, node)
          let inlineStyleSpecifier = `${urlToFilename(url)}@${inlineStyleId}.js`
          const inlineStyleUrl = new URL(inlineStyleSpecifier, url).href
          inlineRessources.push({
            line,
            column,
            url: inlineStyleUrl,
            contentType: "text/css",
            content: textNode.value,
          })
          node.nodeName = "link"
          node.tagName = "link"
          assignHtmlNodeAttributes(node, {
            rel: "stylesheet",
            href: inlineStyleSpecifier,
          })
          removeHtmlNodeText(node)
        }
        const handleInlineScript = (node) => {
          if (node.nodeName !== "script") {
            return
          }
          const scriptCategory = parseScriptNode(node)
          if (scriptCategory === "importmap") {
            // do not externalize importmap for now
            return
          }
          const textNode = getHtmlNodeTextNode(node)
          if (!textNode) {
            return
          }
          const { line, column } = htmlNodePosition.readNodePosition(node, {
            preferOriginal: true,
          })
          const inlineScriptId = getIdForInlineHtmlNode(htmlAst, node)
          let inlineScriptSpecifier = `${urlToFilename(
            url,
          )}@${inlineScriptId}.js`
          if (scriptCategory === "classic") {
            inlineScriptSpecifier = `${inlineScriptSpecifier}?script`
          }
          const inlineScriptUrl = new URL(inlineScriptSpecifier, url).href
          inlineRessources.push({
            line,
            column,
            url: inlineScriptUrl,
            contentType:
              scriptCategory === "importmap"
                ? "application/importmap+json"
                : "application/javascript",
            content: textNode.value,
          })
          assignHtmlNodeAttributes(node, {
            "src": inlineScriptSpecifier,
            "data-externalized": "",
          })
          removeHtmlNodeText(node)
        }
        visitHtmlAst(htmlAst, (node) => {
          handleInlineStyle(node)
          handleInlineScript(node)
        })
        updateInlineRessources({
          ownerUrl: url,
          ownerContent: originalContent,
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
    },
  }
}
