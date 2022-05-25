export const jsenvPluginHmr = () => {
  return {
    name: "jsenv:hmr",
    appliesDuring: { dev: true },
    redirectUrl: (reference) => {
      const urlObject = new URL(reference.url)
      if (!urlObject.searchParams.has("hmr")) {
        reference.data.hmr = false
        return null
      }
      reference.data.hmr = true
      // "hmr" search param goal is to mark url as enabling hmr:
      // this goal is achieved when we reach this part of the code
      // We get rid of this params so that urlGraph and other parts of the code
      // recognize the url (it is not considered as a different url)
      urlObject.searchParams.delete("hmr")
      urlObject.searchParams.delete("v")
      return urlObject.href
    },
    transformUrlSearchParams: (reference, context) => {
      const parentUrlInfo = context.urlGraph.getUrlInfo(reference.parentUrl)
      if (!parentUrlInfo || !parentUrlInfo.data.hmr) {
        return null
      }
      const urlInfo = context.urlGraph.getUrlInfo(reference.url)
      if (!urlInfo.modifiedTimestamp) {
        return null
      }
      return {
        hmr: "",
        v: urlInfo.modifiedTimestamp,
      }
    },
  }
}
