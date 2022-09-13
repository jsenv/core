export const jsenvPluginCacheControl = () => {
  return {
    name: "jsenv:cache_control",
    appliesDuring: "dev",
    augmentResponse: ({ reference }) => {
      if (
        reference.searchParams.has("v") &&
        !reference.searchParams.has("hmr")
      ) {
        return {
          headers: {
            "cache-control": `private,max-age=${SECONDS_IN_30_DAYS},immutable`,
          },
        }
      }
      return null
    },
  }
}

const SECONDS_IN_30_DAYS = 60 * 60 * 24 * 30
