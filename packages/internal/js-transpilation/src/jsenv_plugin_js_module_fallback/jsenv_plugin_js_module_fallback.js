import { urlToFilename } from "@jsenv/urls";
import { systemJsClientFileUrlDefault } from "@jsenv/js-module-fallback";

import { jsenvPluginJsModuleConversion } from "./jsenv_plugin_js_module_conversion.js";
import { jsenvPluginJsModuleFallbackInsideHtml } from "./jsenv_plugin_js_module_fallback_inside_html.js";
import { jsenvPluginJsModuleFallbackOnWorkers } from "./jsenv_plugin_js_module_fallback_on_workers.js";

export const jsenvPluginJsModuleFallback = ({
  systemJsInjection = true,
  systemJsClientFileUrl = systemJsClientFileUrlDefault,
}) => {
  return [
    jsenvPluginJsModuleFallbackInsideHtml({
      systemJsInjection,
      systemJsClientFileUrl,
    }),
    jsenvPluginJsModuleFallbackOnWorkers(),
    jsenvPluginJsModuleConversion({
      systemJsInjection,
      systemJsClientFileUrl,
      generateJsClassicFilename,
    }),
  ];
};

const generateJsClassicFilename = (url) => {
  const filename = urlToFilename(url);
  let [basename, extension] = splitFileExtension(filename);
  const { searchParams } = new URL(url);
  if (
    searchParams.has("as_json_module") ||
    searchParams.has("as_css_module") ||
    searchParams.has("as_text_module")
  ) {
    extension = ".js";
  }
  return `${basename}.nomodule${extension}`;
};

const splitFileExtension = (filename) => {
  const dotLastIndex = filename.lastIndexOf(".");
  if (dotLastIndex === -1) {
    return [filename, ""];
  }
  return [filename.slice(0, dotLastIndex), filename.slice(dotLastIndex)];
};
