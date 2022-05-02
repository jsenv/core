import { DataUrl } from "@jsenv/utils/urls/data_url.js"
import { CONTENT_TYPE } from "@jsenv/utils/content_type/content_type.js"

export const jsenvPluginDataUrls = () => {
  return {
    name: "jsenv:data_urls",
    appliesDuring: "*",
    resolveUrl: (reference) => {
      if (!reference.specifier.startsWith("data:")) {
        return null
      }
      return reference.specifier
    },
    fetchUrlContent: (urlInfo) => {
      if (!urlInfo.url.startsWith("data:")) {
        return null
      }
      const {
        contentType,
        base64Flag,
        data: urlData,
      } = DataUrl.parse(urlInfo.url)
      urlInfo.data.base64Flag = base64Flag
      return {
        contentType,
        content: contentFromUrlData({ contentType, base64Flag, urlData }),
      }
    },
    formatUrl: (reference, context) => {
      if (!reference.url.startsWith("data:")) {
        return null
      }
      if (reference.type === "sourcemap_comment") {
        return null
      }
      return (async () => {
        const urlInfo = context.urlGraph.getUrlInfo(reference.url)
        await context.cook({
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
  if (CONTENT_TYPE.isTextual(contentType)) {
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
