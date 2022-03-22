/*
 *
 */

import { DataUrl } from "@jsenv/core/src/utils/data_url.js"

import { jsenvPluginHtmlInlineScriptsAndStyles } from "./jsenv_plugin_html_scripts_and_styles.js"

export const jsenvPluginInline = () => {
  return [
    jsenvPluginHtmlInlineScriptsAndStyles(),
    dataUrls(),
    inlineQueryParam(),
  ]
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
