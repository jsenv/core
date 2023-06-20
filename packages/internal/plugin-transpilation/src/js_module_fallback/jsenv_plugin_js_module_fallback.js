import { jsenvPluginJsModuleConversion } from "./jsenv_plugin_js_module_conversion.js";
import { jsenvPluginJsModuleFallbackInsideHtml } from "./jsenv_plugin_js_module_fallback_inside_html.js";
import { jsenvPluginJsModuleFallbackOnWorkers } from "./jsenv_plugin_js_module_fallback_on_workers.js";

export const jsenvPluginJsModuleFallback = () => {
  return [
    jsenvPluginJsModuleFallbackInsideHtml(),
    jsenvPluginJsModuleFallbackOnWorkers(),
    jsenvPluginJsModuleConversion(),
  ];
};
