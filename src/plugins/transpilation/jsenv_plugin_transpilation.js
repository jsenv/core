/*
 * Transforms code to make it compatible with browser that would not be able to
 * run it otherwise. For instance:
 * - const -> var
 * - async/await -> promises
 * Anything that is not standard (import.meta.dev for instance) is outside the scope
 * of this plugin
 */

import { jsenvPluginCssTranspilation } from "./css/jsenv_plugin_css_transpilation.js";
import { jsenvPluginImportAssertions } from "./import_assertions/jsenv_plugin_import_assertions.js";
import { jsenvPluginJsModuleFallback } from "./js_module_fallback/jsenv_plugin_js_module_fallback.js";
import { jsenvPluginAsJsModule } from "./as_js_module/jsenv_plugin_as_js_module.js";
import { jsenvPluginBabel } from "./babel/jsenv_plugin_babel.js";
import { jsenvPluginTopLevelAwait } from "./jsenv_plugin_top_level_await.js";
import { jsenvPluginImportMetaResolve } from "./jsenv_plugin_import_meta_resolve.js";

export const jsenvPluginTranspilation = ({
  importAssertions = true,
  css = true,
  // build sets jsModuleFallbackOnJsClassic: false during first step of the build
  // and re-enable it in the second phase (when performing the bundling)
  // so that bundling is applied on js modules THEN it is converted to js classic if needed
  jsModuleFallbackOnJsClassic = true,
  topLevelAwait = true,
  importMetaResolve = true,
  babelHelpersAsImport = true,
  getCustomBabelPlugins,
}) => {
  if (importAssertions === true) {
    importAssertions = {};
  }
  if (jsModuleFallbackOnJsClassic === true) {
    jsModuleFallbackOnJsClassic = {};
  }
  return [
    ...(importMetaResolve ? [jsenvPluginImportMetaResolve()] : []),
    ...(importAssertions
      ? [jsenvPluginImportAssertions(importAssertions)]
      : []),
    // babel also so that rollup can bundle babel helpers for instance
    jsenvPluginBabel({
      topLevelAwait,
      getCustomBabelPlugins,
      babelHelpersAsImport,
    }),
    ...(jsModuleFallbackOnJsClassic
      ? [jsenvPluginJsModuleFallback(jsModuleFallbackOnJsClassic)]
      : []),
    jsenvPluginAsJsModule(),
    // topLevelAwait must come after jsModuleFallback because it's related to the module format
    // so we want to wait to know the module format before transforming things related to top level await
    ...(topLevelAwait ? [jsenvPluginTopLevelAwait(topLevelAwait)] : []),
    ...(css ? [jsenvPluginCssTranspilation()] : []),
  ];
};
