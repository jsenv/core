/*
 *
 */

import { urlToFilename } from "@jsenv/filesystem"

import { DataUrl } from "@jsenv/core/src/utils/data_url.js"
import {
  parseHtmlString,
  stringifyHtmlAst,
  visitHtmlAst,
  getHtmlNodeTextNode,
  getIdForInlineHtmlNode,
  htmlNodePosition,
  parseScriptNode,
  setHtmlNodeText,
} from "@jsenv/core/src/utils/html_ast/html_ast.js"
import { stringifyUrlSite } from "@jsenv/core/src/utils/url_trace.js"
import { injectQueryParamsIntoSpecifier } from "@jsenv/core/src/utils/url_utils.js"

export const jsenvPluginInline = () => {
  return [htmlInlineScriptsAndStyles(), dataUrls(), inlineQueryParam()]
}

const htmlInlineScriptsAndStyles = () => {
  return {
    name: "jsenv:inline_scripts_and_styles",
    appliesDuring: "*",
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
      html: async (
        { url, originalContent, content },
        { cook, addReference, urlGraph },
      ) => {
        const htmlAst = parseHtmlString(content)
        const actions = []
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
        const handleInlineStyle = (node) => {
          if (node.nodeName !== "style") {
            return
          }
          const textNode = getHtmlNodeTextNode(node)
          if (!textNode) {
            return
          }
          actions.push(async () => {
            const inlineStyleId = getIdForInlineHtmlNode(htmlAst, node)
            const inlineStyleSpecifier = `${urlToFilename(
              url,
            )}@${inlineStyleId}.css`
            const inlineStyleReference = addInlineReference({
              node,
              type: "link_href",
              specifier: inlineStyleSpecifier,
              inlineContentType: "text/css",
              inlineContent: textNode.value,
            })
            const inlineUrlInfo = urlGraph.getUrlInfo(inlineStyleReference.url)
            await cook({
              reference: inlineStyleReference,
              urlInfo: inlineUrlInfo,
            })
            setHtmlNodeText(node, inlineUrlInfo.content)
          })
        }
        const handleInlineScript = (node) => {
          if (node.nodeName !== "script") {
            return
          }
          const textNode = getHtmlNodeTextNode(node)
          if (!textNode) {
            return
          }
          actions.push(async () => {
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
              inlineContentType:
                scriptCategory === "importmap"
                  ? "application/importmap+json"
                  : "application/javascript",
              inlineContent: textNode.value,
            })
            const inlineUrlInfo = urlGraph.getUrlInfo(inlineScriptReference.url)
            await cook({
              reference: inlineScriptReference,
              urlInfo: inlineUrlInfo,
            })
            setHtmlNodeText(node, inlineUrlInfo.content)
          })
        }
        visitHtmlAst(htmlAst, (node) => {
          handleInlineStyle(node)
          handleInlineScript(node)
        })
        if (actions.length === 0) {
          return null
        }
        await Promise.all(
          actions.map(async (action) => {
            await action()
          }),
        )
        const htmlModified = stringifyHtmlAst(htmlAst)
        return {
          content: htmlModified,
        }
      },
    },
  }
}

const dataUrls = () => {
  return {
    name: "jsenv:data_urls",
    appliesDuring: "*",
    resolve: ({ specifier }) => {
      if (specifier.startsWith("data:")) {
        return specifier
      }
      return null
    },
    load: ({ url, data }) => {
      if (!url.startsWith("data:")) {
        return null
      }
      const parseResult = DataUrl.parse(url, { as: "raw" })
      data.mediaType = parseResult.mediaType
      data.base64Flag = parseResult.base64Flag
      return {
        contentType: parseResult.mediaType.split(";")[0],
        content: parseResult.data,
      }
    },

    formatReferencedUrl: (reference, { urlGraph, cook }) => {
      if (!reference.url.startsWith("data:")) {
        return null
      }
      return (async () => {
        const urlInfo = urlGraph.getUrlInfo(reference.url)
        await cook({
          reference,
          urlInfo,
        })
        const specifier = DataUrl.stringify({
          mediaType: urlInfo.data.mediaType,
          base64Flag: urlInfo.data.base64Flag,
          data: urlInfo.content,
        })
        return specifier
      })()
    },
  }
}

const inlineQueryParam = () => {
  return {
    name: "jsenv:inline_query_param",
    appliesDuring: "*",
    formatReferencedUrl: (reference, { urlGraph, cook }) => {
      if (!new URL(reference.url).searchParams.has("inline")) {
        return null
      }
      return (async () => {
        const urlInfo = urlGraph.getUrlInfo(reference.url)
        await cook({
          reference,
          urlInfo,
        })
        const specifier = DataUrl.stringify({
          mediaType: urlInfo.contentType,
          base64Flag: true,
          data: urlInfo.content,
        })
        return specifier
      })()
    },
  }
}
