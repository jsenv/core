/*
 * Source code can contain the following
 * - __dev__
 * - __build__
 * A global will be injected with true/false when needed
 */

import { replacePlaceholders } from "@jsenv/plugin-placeholders";

export const jsenvPluginGlobalScenarios = () => {
  const transformIfNeeded = (urlInfo, context) => {
    return replacePlaceholders(urlInfo, {
      __DEV__: context.dev,
      __BUILD__: context.build,
    });
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
