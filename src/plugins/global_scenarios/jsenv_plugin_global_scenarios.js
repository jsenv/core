/*
 * Source code can contain the following
 * - __DEV__
 * - __BUILD__
 * That will be replaced with true/false
 */

import { INJECTIONS } from "../../kitchen/url_graph/url_info_injections.js";

export const jsenvPluginGlobalScenarios = () => {
  const transformIfNeeded = (urlInfo) => {
    return {
      contentInjections: {
        __DEV__: INJECTIONS.optional(urlInfo.context.dev),
        __BUILD__: INJECTIONS.optional(urlInfo.context.build),
      },
    };
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
