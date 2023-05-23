export const jsenvPluginProtocolHttp = () => {
  return {
    name: "jsenv:protocol_http",
    appliesDuring: "*",
    redirectReference: (reference) => {
      if (
        reference.url.startsWith("http:") ||
        reference.url.startsWith("https:")
      ) {
        reference.mustIgnore = true;
      }
      // TODO: according to some pattern matching jsenv could be allowed
      // to fetch and transform http urls
    },
  };
};
