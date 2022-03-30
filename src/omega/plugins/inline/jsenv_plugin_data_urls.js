import { DataUrl } from "@jsenv/utils/urls/data_url.js"
import { ContentType } from "@jsenv/utils/src/content_type.js"

export const jsenvPluginDataUrls = () => {
  return {
    name: "jsenv:data_urls",
    appliesDuring: "*",
    resolve: ({ specifier }) => {
      if (!specifier.startsWith("data:")) {
        return null
      }
      return specifier
    },
    load: ({ url, data }) => {
      if (!url.startsWith("data:")) {
        return null
      }
      const { contentType, base64Flag, data: urlData } = DataUrl.parse(url)
      data.base64Flag = base64Flag
      return {
        contentType,
        content: contentFromUrlData({ contentType, base64Flag, urlData }),
      }
    },
    formatReferencedUrl: (reference, { urlGraph, cook }) => {
      if (!reference.url.startsWith("data:")) {
        return null
      }
      if (reference.type === "sourcemap_comment") {
        return null
      }
      return (async () => {
        const urlInfo = urlGraph.getUrlInfo(reference.url)
        await cook({
          reference,
          urlInfo,
        })
        if (urlInfo.originalContent === urlInfo.content) {
          return reference.url
        }
        const specifier = DataUrl.stringify({
          contentType: urlInfo.contentType,
          base64Flag: urlInfo.data.base64Flag,
          data: urlInfo.data.base64Flag
            ? dataToBase64(urlInfo.content)
            : String(urlInfo.content),
        })
        return specifier
      })()
    },
  }
}

const contentFromUrlData = ({ contentType, base64Flag, urlData }) => {
  if (ContentType.isTextual(contentType)) {
    if (base64Flag) {
      return base64ToString(urlData)
    }
    return urlData
  }
  if (base64Flag) {
    return base64ToBuffer(urlData)
  }
  return Buffer.from(urlData)
}

const base64ToBuffer = (base64String) => Buffer.from(base64String, "base64")
const base64ToString = (base64String) =>
  Buffer.from(base64String, "base64").toString("utf8")
const dataToBase64 = (data) => Buffer.from(data).toString("base64")
