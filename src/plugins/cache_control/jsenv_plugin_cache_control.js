export const jsenvPluginCacheControl = ({
  versionedUrls = true,
  maxAge = SECONDS_IN_30_DAYS,
}) => {
  return {
    name: "jsenv:cache_control",
    appliesDuring: "dev",
    augmentResponse: ({ reference }) => {
      if (
        versionedUrls &&
        reference.searchParams.has("v") &&
        !reference.searchParams.has("hot")
      ) {
        return {
          headers: {
            "cache-control": `private,max-age=${maxAge},immutable`,
          },
        };
      }
      return null;
    },
  };
};

const SECONDS_IN_30_DAYS = 60 * 60 * 24 * 30;
