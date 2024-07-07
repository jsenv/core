/*
 * Transforms code to make it compatible with browser that would not be able to
 * run it otherwise. For instance:
 * - const -> var
 * - async/await -> promises
 * Anything that is not standard (import.meta.dev for instance) is outside the scope
 * of this plugin
 */

import { jsenvPluginImportAttributes } from "./import_attributes/jsenv_plugin_import_attributes.js";
import { jsenvPluginBabel } from "./babel/jsenv_plugin_babel.js";
import { jsenvPluginJsModuleFallback } from "./js_module_fallback/jsenv_plugin_js_module_fallback.js";
import { jsenvPluginAsJsModule } from "./as_js_module/jsenv_plugin_as_js_module.js";
import { jsenvPluginCssTranspilation } from "./css/jsenv_plugin_css_transpilation.js";

export const jsenvPluginTranspilation = ({
  importAttributes = true,
  css = true, // TODO
  // build sets jsModuleFallback: false during first step of the build
  // and re-enable it in the second phase (when performing the bundling)
  // so that bundling is applied on js modules THEN it is converted to js classic if needed
  jsModuleFallback = true,
  babelHelpersAsImport = true,
}) => {
  if (importAttributes === true) {
    importAttributes = {};
  }
  if (jsModuleFallback === true) {
    jsModuleFallback = {};
  }
  return [
    // babel also so that rollup can bundle babel helpers for instance
    jsenvPluginBabel({
      babelHelpersAsImport,
    }),
    jsenvPluginAsJsModule(),
    ...(jsModuleFallback ? [jsenvPluginJsModuleFallback()] : []),
    ...(importAttributes
      ? [jsenvPluginImportAttributes(importAttributes)]
      : []),

    ...(css ? [jsenvPluginCssTranspilation()] : []),
  ];
};
