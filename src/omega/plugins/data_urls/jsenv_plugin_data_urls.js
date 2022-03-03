import { DataUrl } from "@jsenv/core/src/utils/data_url.js"

export const jsenvPluginDataUrls = () => {
  return {
    name: "jsenv:data_urls",
    appliesDuring: "*",
    resolve: ({ specifier }) => {
      if (specifier.startsWith("data:")) {
        return specifier
      }
      return null
    },
    load: ({ url }) => {
      if (!url.startsWith("data:")) {
        return null
      }
      const { mediaType, data } = DataUrl.parse(url, { as: "raw" })
      return {
        contentType: mediaType.split(";")[0],
        content: data,
      }
    },
  }
}
