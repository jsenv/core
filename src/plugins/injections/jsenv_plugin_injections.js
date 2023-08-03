import { URL_META } from "@jsenv/url-meta";
import { asUrlWithoutSearch } from "@jsenv/urls";
import { createMagicSource } from "@jsenv/sourcemap";

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
      return replacePlaceholders(urlInfo.content, injections, urlInfo);
    },
  };
};

const injectionSymbol = Symbol.for("jsenv_injection");
export const INJECTIONS = {
  optional: (value) => {
    return { [injectionSymbol]: "optional", value };
  },
};

// we export this because it is imported by jsenv_plugin_placeholder.js and unit test
export const replacePlaceholders = (content, replacements, urlInfo) => {
  const magicSource = createMagicSource(content);
  for (const key of Object.keys(replacements)) {
    let index = content.indexOf(key);
    const replacement = replacements[key];
    let isOptional;
    let value;
    if (replacement && replacement[injectionSymbol]) {
      const valueBehindSymbol = replacement[injectionSymbol];
      isOptional = valueBehindSymbol === "optional";
      value = replacement.value;
    } else {
      value = replacement;
    }
    if (index === -1) {
      if (!isOptional) {
        urlInfo.context.logger.warn(
          `placeholder "${key}" not found in ${urlInfo.url}.
--- suggestion a ---
Add "${key}" in that file.
--- suggestion b ---
Fix eventual typo in "${key}"?
--- suggestion c ---
Mark injection as optional using INJECTIONS.optional()

import { INJECTIONS } from "@jsenv/core";

return {
  "${key}": INJECTIONS.optional(${JSON.stringify(value)}),
}`,
        );
      }
      continue;
    }

    while (index !== -1) {
      const start = index;
      const end = index + key.length;
      magicSource.replace({
        start,
        end,
        replacement:
          urlInfo.type === "js_classic" ||
          urlInfo.type === "js_module" ||
          urlInfo.type === "html"
            ? JSON.stringify(value, null, "  ")
            : value,
      });
      index = content.indexOf(key, end);
    }
  }
  return magicSource.toContentAndSourcemap();
};
