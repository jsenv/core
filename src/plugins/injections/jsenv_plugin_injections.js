import { URL_META } from "@jsenv/url-meta";
import { asUrlWithoutSearch } from "@jsenv/urls";

export const jsenvPluginInjections = (rawAssociations) => {
  let getInjections = null;

  return {
    name: "jsenv:injections",
    appliesDuring: "*",
    init: (context) => {
      if (rawAssociations && Object.keys(rawAssociations).length > 0) {
        const resolvedAssociations = URL_META.resolveAssociations(
          { injectionsGetter: rawAssociations },
          context.rootDirectoryUrl,
        );
        getInjections = (urlInfo) => {
          const { injectionsGetter } = URL_META.applyAssociations({
            url: asUrlWithoutSearch(urlInfo.url),
            associations: resolvedAssociations,
          });
          if (!injectionsGetter) {
            return null;
          }
          if (typeof injectionsGetter !== "function") {
            throw new TypeError("injectionsGetter must be a function");
          }
          return injectionsGetter(urlInfo);
        };
      }
    },
    transformUrlContent: async (urlInfo) => {
      if (!getInjections) {
        return null;
      }
      const injectionsResult = getInjections(urlInfo);
      if (!injectionsResult) {
        return null;
      }
      const injections = await injectionsResult;
      return {
        contentInjections: injections,
      };
    },
  };
};
