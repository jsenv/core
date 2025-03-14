import { URL_META } from "@jsenv/url-meta";

export const jsenvPluginMappings = (mappings) => {
  if (!mappings || Object.keys(mappings).length === 0) {
    return [];
  }

  const mappingResolvedMap = new Map();
  return {
    name: "jsenv:mappings",
    appliesDuring: "build",
    init: (context) => {
      const kitchen = context.kitchen;
      const sourceDirectoryUrl = context.rootDirectoryUrl;
      for (const key of Object.keys(mappings)) {
        const value = mappings[key];
        const keyResolved = kitchen.resolve(key, sourceDirectoryUrl);
        const valueResolved = kitchen.resolve(value, sourceDirectoryUrl);
        mappingResolvedMap.set(keyResolved.url, valueResolved.url);
      }
    },
    redirectReference: (reference) => {
      for (const [key, value] of mappingResolvedMap) {
        const matchResult = URL_META.applyPatternMatching({
          pattern: key,
          url: reference.url,
        });
        if (!matchResult.matched) {
          continue;
        }
        if (!value.includes("*")) {
          return value;
        }
        const { matchGroups } = matchResult;
        const parts = value.split("*");
        let newUrl = "";
        let index = 0;
        for (const part of parts) {
          newUrl += `${part}`;
          if (index < parts.length - 1) {
            newUrl += matchGroups[index];
          }
          index++;
        }
        return newUrl;
      }
      return null;
    },
  };
};

// import { applyNodeEsmResolution } from "@jsenv/node-esm-resolution";
// const plugin = jsenvPluginMappings({
//   "emoji-regex/index.js": "emoji-regex/index.mjs",
// });
// plugin.init({
//   rootDirectoryUrl: import.meta.resolve("./"),
//   kitchen: {
//     resolve: (specifier, importer) => {
//       return applyNodeEsmResolution({
//         parentUrl: importer,
//         specifier,
//       });
//     },
//   },
// });
// plugin.redirectReference({
//   url: import.meta.resolve("emoji-regex/index.js"),
// });
