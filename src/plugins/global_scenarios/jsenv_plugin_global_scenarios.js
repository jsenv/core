/*
 * Source code can contain the following
 * - __dev__
 * - __build__
 * A global will be injected with true/false when needed
 */

import { replacePlaceholders, PLACEHOLDER } from "@jsenv/plugin-injections";

export const jsenvPluginGlobalScenarios = () => {
  const transformIfNeeded = (urlInfo) => {
    return replacePlaceholders(
      urlInfo.content,
      {
        __DEV__: PLACEHOLDER.optional(urlInfo.context.dev),
        __BUILD__: PLACEHOLDER.optional(urlInfo.context.build),
      },
      urlInfo,
    );
  };

  return {
    name: "jsenv:global_scenario",
    appliesDuring: "*",
    transformUrlContent: {
      js_classic: transformIfNeeded,
      js_module: transformIfNeeded,
      html: transformIfNeeded,
    },
  };
};
