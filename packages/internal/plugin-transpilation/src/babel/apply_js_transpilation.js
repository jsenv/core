import { applyBabelPlugins } from "@jsenv/ast";
import { RUNTIME_COMPAT } from "@jsenv/runtime-compat";

import { getBaseBabelPluginStructure } from "./babel_plugin_structure.js";
import { babelPluginBabelHelpersAsJsenvImports } from "./babel_plugin_babel_helpers_as_jsenv_imports.js";
import { babelPluginNewStylesheetInjector } from "./new_stylesheet/babel_plugin_new_stylesheet_injector.js";
import { babelPluginGlobalThisInjector } from "./global_this/babel_plugin_global_this_injector.js";
import { babelPluginRegeneratorRuntimeInjector } from "./regenerator_runtime/babel_plugin_regenerator_runtime_injector.js";

export const applyJsTranspilation = async ({
  input,
  inputIsJsModule = false,
  inputUrl,
  outputUrl,
  runtimeCompat,
  babelHelpersAsImport = true,
  babelOptions,
  getImportSpecifier,
}) => {
  const isSupported = (feature) => {
    return RUNTIME_COMPAT.isSupported(runtimeCompat, feature);
  };
  const babelPluginStructure = getBaseBabelPluginStructure({
    url: inputUrl,
    isSupported,
    isJsModule: inputIsJsModule,
    getImportSpecifier,
  });

  if (!isSupported("global_this")) {
    babelPluginStructure["global-this-injector"] = [
      babelPluginGlobalThisInjector,
      { babelHelpersAsImport, getImportSpecifier },
    ];
  }
  if (!isSupported("async_generator_function")) {
    babelPluginStructure["regenerator-runtime-injector"] = [
      babelPluginRegeneratorRuntimeInjector,
      { babelHelpersAsImport, getImportSpecifier },
    ];
  }
  if (!isSupported("new_stylesheet")) {
    babelPluginStructure["new-stylesheet-injector"] = [
      babelPluginNewStylesheetInjector,
      { babelHelpersAsImport, getImportSpecifier },
    ];
  }
  if (
    inputIsJsModule &&
    babelHelpersAsImport &&
    Object.keys(babelPluginStructure).length > 0
  ) {
    babelPluginStructure["babel-helper-as-jsenv-import"] = [
      babelPluginBabelHelpersAsJsenvImports,
      { getImportSpecifier },
    ];
  }

  const babelPlugins = Object.keys(babelPluginStructure).map(
    (babelPluginName) => babelPluginStructure[babelPluginName],
  );
  const { code, map } = await applyBabelPlugins({
    babelPlugins,
    options: babelOptions,
    input,
    inputIsJsModule,
    inputUrl,
    outputUrl,
  });
  return {
    content: code,
    sourcemap: map,
  };
};
