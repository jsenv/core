export const jsenvPluginWebResolution = () => {
  return {
    name: "jsenv:web_resolution",
    appliesDuring: "*",
    resolveReference: (reference) => {
      const { ownerUrlInfo } = reference;
      if (reference.specifier === "/") {
        const { mainFilePath, rootDirectoryUrl } = ownerUrlInfo.context;
        const url = new URL(mainFilePath, rootDirectoryUrl);
        return url;
      }
      if (reference.specifier[0] === "/") {
        const url = new URL(
          reference.specifier.slice(1),
          ownerUrlInfo.context.rootDirectoryUrl,
        );
        return url;
      }
      const url = new URL(
        reference.specifier,
        // baseUrl happens second argument to new URL() is different from
        // import.meta.url or document.currentScript.src
        reference.baseUrl || ownerUrlInfo.originalUrl || ownerUrlInfo.url,
      );
      return url;
    },
  };
};
