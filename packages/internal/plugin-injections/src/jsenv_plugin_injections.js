import { URL_META } from "@jsenv/url-meta";
import { asUrlWithoutSearch } from "@jsenv/urls";
import { composeTwoSourcemaps } from "@jsenv/sourcemap";

import { replacePlaceholders } from "./internal/replace_placeholders.js";
import { injectGlobals } from "./internal/inject_globals.js";

export const jsenvPluginInjections = (rawAssociations) => {
  let resolvedAssociations;

  return {
    name: "jsenv:injections",
    appliesDuring: "*",
    init: (context) => {
      resolvedAssociations = URL_META.resolveAssociations(
        { injectionsGetter: rawAssociations },
        context.rootDirectoryUrl,
      );
    },
    transformUrlContent: async (urlInfo) => {
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
      const injections = await injectionsGetter(urlInfo);
      if (!injections) {
        return null;
      }
      const keys = Object.keys(injections);
      if (keys.length === 0) {
        return null;
      }
      let someGlobal = false;
      let someReplacement = false;
      const globals = {};
      const replacements = {};
      for (const key of keys) {
        const { type, name, value } = createInjection(injections[key], key);
        if (type === "global") {
          globals[name] = value;
          someGlobal = true;
        } else {
          replacements[name] = value;
          someReplacement = true;
        }
      }

      if (!someGlobal && !someReplacement) {
        return null;
      }

      let content = urlInfo.content;
      let sourcemap;
      if (someGlobal) {
        const globalInjectionResult = injectGlobals(content, globals, urlInfo);
        content = globalInjectionResult.content;
        sourcemap = globalInjectionResult.sourcemap;
      }
      if (someReplacement) {
        const replacementResult = replacePlaceholders(
          content,
          replacements,
          urlInfo,
        );
        content = replacementResult.content;
        sourcemap = sourcemap
          ? composeTwoSourcemaps(sourcemap, replacementResult.sourcemap)
          : replacementResult.sourcemap;
      }
      return {
        content,
        sourcemap,
      };
    },
  };
};

const wellKnowGlobalNames = ["window", "global", "globalThis", "self"];
const createInjection = (value, key) => {
  for (const wellKnowGlobalName of wellKnowGlobalNames) {
    const prefix = `${wellKnowGlobalName}.`;
    if (key.startsWith(prefix)) {
      return {
        type: "global",
        name: key.slice(prefix.length),
        value,
      };
    }
  }
  return {
    type: "replacement",
    name: key,
    value,
  };
};
