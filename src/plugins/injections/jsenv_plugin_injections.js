import { URL_META } from "@jsenv/url-meta";
import { asUrlWithoutSearch, urlToRelativeUrl } from "@jsenv/urls";
import { INJECTIONS } from "../../kitchen/url_graph/url_info_injections.js";

export const jsenvPluginInjections = (rawAssociations) => {
  const getDefaultInjections = (urlInfo) => {
    if (urlInfo.context.dev && urlInfo.type === "html") {
      const relativeUrl = urlToRelativeUrl(
        urlInfo.url,
        urlInfo.context.rootDirectoryUrl,
      );
      return {
        HTML_ROOT_URL: INJECTIONS.global(`/${relativeUrl}`),
      };
    }
    return null;
  };
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
      const defaultInjections = getDefaultInjections(urlInfo);
      if (!getInjections) {
        return {
          contentInjections: defaultInjections,
        };
      }
      const injectionsResult = getInjections(urlInfo);
      if (!injectionsResult) {
        return {
          contentInjections: defaultInjections,
        };
      }
      const injections = await injectionsResult;
      return {
        contentInjections: {
          ...defaultInjections,
          ...injections,
        },
      };
    },
  };
};
