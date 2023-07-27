import { jsenvPluginJsModuleConversion } from "./jsenv_plugin_js_module_conversion.js";
import { jsenvPluginJsModuleFallbackInsideHtml } from "./jsenv_plugin_js_module_fallback_inside_html.js";
import { jsenvPluginJsModuleFallbackOnWorkers } from "./jsenv_plugin_js_module_fallback_on_workers.js";
import { jsenvPluginImportMetaResolve } from "./jsenv_plugin_import_meta_resolve.js";
import { jsenvPluginTopLevelAwait } from "./jsenv_plugin_top_level_await.js";

export const jsenvPluginJsModuleFallback = ({ remapImportSpecifier } = {}) => {
  const needJsModuleFallback = (context) => {
    if (
      context.versioning &&
      context.versioningViaImportmap &&
      !context.isSupportedOnCurrentClients("importmap")
    ) {
      return true;
    }
    if (
      !context.isSupportedOnCurrentClients("script_type_module") ||
      !context.isSupportedOnCurrentClients("import_dynamic") ||
      !context.isSupportedOnCurrentClients("import_meta")
    ) {
      return true;
    }
    return false;
  };

  return [
    jsenvPluginJsModuleFallbackInsideHtml({ needJsModuleFallback }),
    jsenvPluginJsModuleFallbackOnWorkers(),
    jsenvPluginJsModuleConversion({ remapImportSpecifier }),
    // must come after jsModuleFallback because it's related to the module format
    // so we want to want to know the module format before transforming things
    // - top level await
    // - import.meta.resolve()
    jsenvPluginImportMetaResolve({ needJsModuleFallback }),
    jsenvPluginTopLevelAwait({ needJsModuleFallback }),
  ];
};
