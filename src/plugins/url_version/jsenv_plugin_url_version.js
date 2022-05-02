export const jsenvPluginUrlVersion = ({
  longTermCache = false, // will become true once things get more stable
} = {}) => {
  return {
    name: "jsenv:url_version",
    appliesDuring: "*", // maybe only during dev?
    normalizeUrl: (reference) => {
      // "v" search param goal is to enable long-term cache
      // for server response headers
      // it is also used by hmr to bypass browser cache
      // this goal is achieved when we reach this part of the code
      // We get rid of this params so that urlGraph and other parts of the code
      // recognize the url (it is not considered as a different url)
      const urlObject = new URL(reference.url)
      urlObject.searchParams.delete("v")
      return urlObject.href
    },
    transformUrl: (reference) => {
      if (!reference.data.version) {
        return null
      }
      if (reference.searchParams.has("v")) {
        return null
      }
      return {
        v: reference.data.version,
      }
    },
    augmentResponse: ({ url }) => {
      if (!longTermCache) {
        return null
      }
      const urlObject = new URL(url)
      if (!urlObject.searchParams.has("v")) {
        return null
      }
      if (urlObject.searchParams.has("hmr")) {
        return null
      }
      // When url is versioned put it in browser cache for 30 days
      return {
        headers: {
          "cache-control": `private,max-age=${SECONDS_IN_30_DAYS},immutable`,
        },
      }
    },
  }
}

const SECONDS_IN_30_DAYS = 60 * 60 * 24 * 30
