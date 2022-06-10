export const jsenvPluginHttpUrls = () => {
  return {
    name: "jsenv:http_urls",
    appliesDuring: "*",
    fetchUrlContent: (urlInfo) => {
      if (urlInfo.url.startsWith("http") || urlInfo.url.startsWith("https")) {
        return { shouldIgnore: true }
      }
      return null
    },
  }
}
