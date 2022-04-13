export const jsenvPluginHttpUrls = () => {
  return {
    name: "jsenv:http_urls",
    appliesDuring: "*",
    load: (urlInfo) => {
      if (urlInfo.url.startsWith("http") || urlInfo.url.startsWith("https")) {
        return { external: true }
      }
      return null
    },
  }
}
