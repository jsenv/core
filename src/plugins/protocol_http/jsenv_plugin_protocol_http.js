export const jsenvPluginProtocolHttp = () => {
  return {
    name: "jsenv:protocol_http",
    appliesDuring: "*",
    redirectReference: (reference) => {
      // TODO: according to some pattern matching jsenv could be allowed
      // to fetch and transform http urls
      if (
        reference.url.startsWith("http:") ||
        reference.url.startsWith("https:")
      ) {
        return `ignore:${reference.url}`;
      }
      return null;
    },
  };
};
