/*
 * Source code can contain the following
 * - __DEV__
 * - __BUILD__
 * That will be replaced with true/false
 */

import { INJECTIONS } from "../../kitchen/url_graph/url_info_injections.js";

export const jsenvPluginGlobalScenarios = () => {
  const transformIfNeeded = (urlInfo) => {
    // Do not scan node modules for __DEV__/__BUILD__
    // - node modules won't have this in their code
    // - ;or should use other an other technic as this one won't be available
    // They would be discarded by content.includes detection
    // but it's cheaper to detect by URL than to scan potentially large files
    if (urlInfo.url.includes("/node_modules/")) {
      return null;
    }
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
