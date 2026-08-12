import { URL_META } from "@jsenv/url-meta";
import { asUrlWithoutSearch, urlToRelativeUrl } from "@jsenv/urls";
import {
  INJECTIONS,
  isPlaceholderInjection,
} from "../../kitchen/url_graph/url_info_injections.js";

export const jsenvPluginInjections = (rawAssociations) => {
  const getDefaultInjections = (urlInfo) => {
    if (urlInfo.context.dev && urlInfo.type === "html") {
      const relativeUrl = urlToRelativeUrl(
        urlInfo.url,
        urlInfo.context.rootDirectoryUrl,
      );
      return {
        HTML_ROOT_PATHNAME: INJECTIONS.global(`/${relativeUrl}`),
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
        const findInjectionsGetter = (urlInfo) => {
          const { injectionsGetter } = URL_META.applyAssociations({
            url: asUrlWithoutSearch(urlInfo.url),
            associations: resolvedAssociations,
          });
          if (injectionsGetter) {
            return { injectionsGetter, isInherited: false };
          }
          if (urlInfo.isInline) {
            // content inlined into a file (a <script> inside html) is authored in that
            // file, so injections configured for the file must reach it too
            const found = findInjectionsGetter(
              urlInfo.firstReference.ownerUrlInfo,
            );
            if (found) {
              return {
                injectionsGetter: found.injectionsGetter,
                isInherited: true,
              };
            }
          }
          return null;
        };
        getInjections = async (urlInfo) => {
          const found = findInjectionsGetter(urlInfo);
          if (!found) {
            return null;
          }
          const { injectionsGetter, isInherited } = found;
          if (typeof injectionsGetter !== "function") {
            throw new TypeError("injectionsGetter must be a function");
          }
          const injections = await injectionsGetter(urlInfo);
          if (!injections || !isInherited) {
            return injections;
          }
          return asInheritedInjections(injections);
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
      const injections = await getInjections(urlInfo);
      if (!injections) {
        return {
          contentInjections: defaultInjections,
        };
      }
      return {
        contentInjections: {
          ...defaultInjections,
          ...injections,
        },
      };
    },
  };
};

// What a file inlines (a <script> or a <style> inside html) is authored in that file
// and inherits its injections, with two adjustments:
// - a global belongs to the file itself, injecting it into each inline content would
//   repeat it and reach types that cannot receive globals (css)
// - a placeholder configured for the file is expected in one of its inline contents,
//   not in each, so a missing one is not worth a warning
const asInheritedInjections = (injections) => {
  const inheritedInjections = {};
  for (const key of Object.keys(injections)) {
    const value = injections[key];
    if (isPlaceholderInjection(value)) {
      inheritedInjections[key] = INJECTIONS.optional(value);
    }
  }
  if (Object.keys(inheritedInjections).length === 0) {
    return null;
  }
  return inheritedInjections;
};
