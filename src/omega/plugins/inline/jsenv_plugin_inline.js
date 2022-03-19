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
  removeHtmlNodeText,
  assignHtmlNodeAttributes,
  htmlNodePosition,
  parseScriptNode,
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
    load: ({ data }) => {
      if (data.inlineInfo) {
        return {
          contentType: data.inlineInfo.contentType,
          content: data.inlineInfo.content,
        }
      }
      return null
    },
    transform: {
      html: ({ url, originalContent, content }, { addReference, urlGraph }) => {
        const htmlAst = parseHtmlString(content)
        let foundSomethingInline = false
        const addInlineReference = ({
          node,
          type,
          specifier,
          inlineContentType,
          inlineContent,
        }) => {
          foundSomethingInline = true
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
          inlineUrlInfo.inlineInfo = {
            urlSite: {
              url,
              content: originalContent, // original because it's the origin line and column
              // we remove 1 to the line because imagine the following html:
              // <script>console.log('ok')</script>
              // -> code starts at the same line than script tag
              line: line - 1,
              column,
            },
            contentType: inlineContentType,
            content: inlineContent,
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
          const inlineStyleReference = addInlineReference({
            node,
            type: "link_href",
            specifier: `${urlToFilename(url)}@${inlineStyleId}.js`,
            inlineContentType: "text/css",
            inlineContent: textNode.value,
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
        visitHtmlAst(htmlAst, (node) => {
          handleInlineStyle(node)
          handleInlineScript(node)
        })
        if (!foundSomethingInline) {
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
    // TODO: test this
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
        return DataUrl.stringify({
          mediaType: urlInfo.data.mediaType,
          base64Flag: urlInfo.data.base64Flag,
          data: urlInfo.content,
        })
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
        return DataUrl.stringify({
          mediaType: urlInfo.contentType,
          base64Flag: true,
          data: urlInfo.content,
        })
      })()
    },
  }
}
