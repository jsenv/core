import { urlTypeFromReference } from "../url_type_from_reference.js";

export const jsenvPluginWebResolution = (resolutionConfig = {}) => {
  const resolvers = {};
  const resolveUsingWebResolution = (reference, context) => {
    if (reference.specifier === "/") {
      const { mainFilePath, rootDirectoryUrl } = context;
      return String(new URL(mainFilePath, rootDirectoryUrl));
    }
    if (reference.specifier[0] === "/") {
      return new URL(reference.specifier.slice(1), context.rootDirectoryUrl)
        .href;
    }
    return new URL(
      reference.specifier,
      // baseUrl happens second argument to new URL() is different from
      // import.meta.url or document.currentScript.src
      reference.baseUrl || reference.parentUrl,
    ).href;
  };
  Object.keys(resolutionConfig).forEach((urlType) => {
    const config = resolutionConfig[urlType];
    if (config === true) {
      resolvers[urlType] = resolveUsingWebResolution;
    } else if (config === false) {
      resolvers[urlType] = () => null;
    } else {
      throw new TypeError(
        `config must be true or false, got ${config} on "${urlType}"`,
      );
    }
  });

  return {
    name: "jsenv:web_resolution",
    appliesDuring: "*",
    resolveUrl: (reference, context) => {
      const urlType = urlTypeFromReference(reference, context);
      const resolver = resolvers[urlType];
      return resolver
        ? resolver(reference, context)
        : resolveUsingWebResolution(reference, context);
    },
  };
};
