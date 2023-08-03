/*
 * Source code can contain the following
 * - __DEV__
 * - __BUILD__
 * That will be replaced with true/false
 */

import {
  replacePlaceholders,
  INJECTIONS,
} from "../injections/jsenv_plugin_injections.js";

export const jsenvPluginGlobalScenarios = () => {
  const transformIfNeeded = (urlInfo) => {
    return replacePlaceholders(
      urlInfo.content,
      {
        __DEV__: INJECTIONS.optional(urlInfo.context.dev),
        __BUILD__: INJECTIONS.optional(urlInfo.context.build),
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
