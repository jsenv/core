export const jsenvPluginWebResolution = () => {
  return {
    name: "jsenv:web_resolution",
    appliesDuring: "*",
    resolveReference: (reference) => {
      const { ownerUrlInfo } = reference;
      if (reference.specifierPathname[0] === "/") {
        const url = new URL(
          reference.specifier.slice(1),
          ownerUrlInfo.originalUrl?.startsWith("http")
            ? ownerUrlInfo.originalUrl
            : ownerUrlInfo.context.rootDirectoryUrl,
        );
        return url;
      }
      // baseUrl happens second argument to new URL() is different from
      // import.meta.url or document.currentScript.src
      const parentUrl =
        reference.baseUrl || ownerUrlInfo.context.dev
          ? ownerUrlInfo.url
          : ownerUrlInfo.originalUrl || ownerUrlInfo.url;
      const url = new URL(reference.specifier, parentUrl);
      return url;
    },
  };
};
