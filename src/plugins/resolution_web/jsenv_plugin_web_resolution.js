export const jsenvPluginWebResolution = () => {
  return {
    name: "jsenv:web_resolution",
    appliesDuring: "*",
    resolveReference: (reference) => {
      const { ownerUrlInfo } = reference;
      if (reference.specifierPathname[0] === "/") {
        const resource = reference.specifier;
        if (ownerUrlInfo.originalUrl?.startsWith("http")) {
          return new URL(resource, ownerUrlInfo.originalUrl);
        }
        const url = new URL(resource.slice(1), ownerUrlInfo.entryUrlInfo.url);
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
