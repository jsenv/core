import { URL_META } from "@jsenv/url-meta";
import { asUrlWithoutSearch } from "@jsenv/urls";

import { replacePlaceholders } from "./replace_placeholders.js";

export const jsenvPluginPlaceholders = (rawAssociations) => {
  let resolvedAssociations;

  return {
    name: "jsenv:placeholders",
    appliesDuring: "*",
    init: (context) => {
      resolvedAssociations = URL_META.resolveAssociations(
        { replacer: rawAssociations },
        context.rootDirectoryUrl,
      );
    },
    transformUrlContent: async (urlInfo, context) => {
      const { replacer } = URL_META.applyAssociations({
        url: asUrlWithoutSearch(urlInfo.url),
        associations: resolvedAssociations,
      });
      if (!replacer) {
        return null;
      }
      if (typeof replacer !== "function") {
        throw new TypeError("replacer must be a function");
      }
      const replacements = await replacer(urlInfo, context);
      if (!replacements || Object.keys(replacements).length === 0) {
        return null;
      }
      return replacePlaceholders(urlInfo, replacements);
    },
  };
};
