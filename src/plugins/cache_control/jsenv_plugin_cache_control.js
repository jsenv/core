export const jsenvPluginCacheControl = () => {
  return {
    name: "jsenv:cache_control",
    appliesDuring: "dev",
    augmentResponse: ({ reference }, context) => {
      if (context.scenarios.test) {
        // During dev, all files are put into browser cache for 1 hour because:
        // 1: Browser cache is a temporary directory created by playwright
        // 2: We assume source files won't be modified while tests are running
        return {
          headers: {
            "cache-control": `private,max-age=3600,immutable`,
          },
        }
      }
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
