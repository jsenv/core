export const jsenvPluginWebResolution = () => {
  return {
    name: "jsenv:web_resolution",
    appliesDuring: "*",
    resolveReference: (reference) => {
      const { ownerUrlInfo } = reference;
      if (reference.specifier === "/") {
        const { mainFilePath, rootDirectoryUrl } = ownerUrlInfo.context;
        return String(new URL(mainFilePath, rootDirectoryUrl));
      }
      if (reference.specifier[0] === "/") {
        return new URL(
          reference.specifier.slice(1),
          ownerUrlInfo.context.rootDirectoryUrl,
        ).href;
      }
      return new URL(
        reference.specifier,
        // baseUrl happens second argument to new URL() is different from
        // import.meta.url or document.currentScript.src
        reference.baseUrl || ownerUrlInfo.url,
      ).href;
    },
  };
};
