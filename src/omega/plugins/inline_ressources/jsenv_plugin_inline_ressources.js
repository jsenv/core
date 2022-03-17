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
import { stringifyUrlSite } from "@jsenv/core/src/utils/url_trace.js"
import { injectQueryParamsIntoSpecifier } from "@jsenv/core/src/utils/url_utils.js"

export const jsenvPluginInlineRessources = () => {
  /**
   * can be represented as below
   * "file:///project_directory/index.html.L10-L12.js": {
   *   "ownerUrl": "file:///project_directory/index.html",
   *   "content": "console.log(42)",
   *   "contentType": "application/javascript",
   * }
   * It is used to serve inline ressources as if they where inside a file
   * Every time the html file is retransformed, the list of inline ressources inside it
   * are deleted so that when html file and page is reloaded, the inline ressources are updated
   */
  const inlineRessourceMap = new Map()
  const updateInlineRessources = ({ ownerUrl, inlineRessources }) => {
    inlineRessourceMap.forEach((inlineRessource, inlineRessourceUrl) => {
      if (inlineRessource.ownerUrl === ownerUrl) {
        inlineRessourceMap.delete(inlineRessourceUrl)
      }
    })
    inlineRessources.forEach((inlineRessource) => {
      inlineRessourceMap.set(inlineRessource.url, {
        ...inlineRessource,
        ownerUrl,
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
    transform: {
      html: ({ url, originalContent, content }, { addReference, urlGraph }) => {
        const htmlAst = parseHtmlString(content)
        const inlineRessources = []
        const createAndResolveInlineReference = ({ node, type, specifier }) => {
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
          // later we'll infer the reference from url graph
          // or we'll want to get the proper trace
          // when transforming this url
          // check if this works and how to make it work
          inlineUrlInfo.data.isInline = true
          inlineUrlInfo.data.inlineUrlSite = {
            url,
            content: originalContent, // original because it's the origin line and column
            line,
            column,
          }
          return inlineReference
        }

        const handleInlineStyle = (node) => {
          if (node.nodeName !== "style") {
            return
          }
          const textNode = getHtmlNodeTextNode(node)
          if (!textNode) {
            return
          }
          const inlineStyleId = getIdForInlineHtmlNode(htmlAst, node)
          const inlineStyleReference = createAndResolveInlineReference({
            node,
            type: "link_href",
            specifier: `${urlToFilename(url)}@${inlineStyleId}.js`,
          })
          inlineRessources.push({
            url: inlineStyleReference.url,
            contentType: "text/css",
            content: textNode.value,
          })
          node.nodeName = "link"
          node.tagName = "link"
          assignHtmlNodeAttributes(node, {
            rel: "stylesheet",
            href: inlineStyleReference.specifier,
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
          const inlineScriptId = getIdForInlineHtmlNode(htmlAst, node)
          const inlineScriptSpecifier = `${urlToFilename(
            url,
          )}@${inlineScriptId}.js`
          const inlineScriptReference = createAndResolveInlineReference({
            node,
            type: "script_src",
            specifier:
              scriptCategory === "classic"
                ? injectQueryParamsIntoSpecifier(inlineScriptSpecifier, {
                    js_classic: "",
                  })
                : inlineScriptSpecifier,
          })
          inlineRessources.push({
            url: inlineScriptReference.url,
            contentType:
              scriptCategory === "importmap"
                ? "application/importmap+json"
                : "application/javascript",
            content: textNode.value,
          })
          assignHtmlNodeAttributes(node, {
            "src": inlineScriptReference.generatedSpecifier,
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
