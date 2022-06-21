export const jsenvPluginHttpUrls = () => {
  return {
    name: "jsenv:http_urls",
    appliesDuring: "*",
    redirectUrl: (reference) => {
      if (
        reference.url.startsWith("http:") ||
        reference.url.startsWith("https:")
      ) {
        reference.shouldHandle = false
      }
      // TODO: according to some pattern matching jsenv could be allowed
      // to fetch and transform http urls
    },
  }
}
