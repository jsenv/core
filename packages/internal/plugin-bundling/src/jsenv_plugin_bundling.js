import { bundleCss } from "./css/css_bundling_lightning_css.js";
// import { bundleJsClassic } from "./js_classic/bundle_js_classic.js";
import { bundleJsModules } from "./js_module/bundle_js_modules.js";

export const jsenvPluginBundling = ({
  css = {},
  js_classic = {},
  js_module = {},
} = {}) => {
  const bundle = {};

  if (css) {
    bundle.css = (cssUrlInfos) => {
      return bundleCss(cssUrlInfos);
    };
  }
  if (js_classic) {
    // bundle.js_classic = (jsClassicUrlInfos) => {
    //   return bundleJsClassic(jsClassicUrlInfos, js_classic);
    // };
  }
  if (js_module) {
    if (js_module === true) {
      js_module = {};
    }
    bundle.js_module = (jsModuleUrlInfos) => {
      return bundleJsModules(jsModuleUrlInfos, js_module);
    };
  }

  return {
    name: "jsenv:bundling",
    appliesDuring: "build",
    bundle,
  };
};
