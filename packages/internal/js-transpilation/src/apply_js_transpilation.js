import { applyBabelPlugins } from "@jsenv/ast";
import { RUNTIME_COMPAT } from "@jsenv/runtime-compat";

import { getBaseBabelPluginStructure } from "./internal/babel_plugin_structure.js";
import { babelPluginBabelHelpersAsJsenvImports } from "./internal/babel_plugin_babel_helpers_as_jsenv_imports.js";
import { babelPluginNewStylesheetAsJsenvImport } from "./internal/new_stylesheet/babel_plugin_new_stylesheet_as_jsenv_import.js";
import { babelPluginGlobalThisAsJsenvImport } from "./internal/global_this/babel_plugin_global_this_as_jsenv_import.js";
import { babelPluginRegeneratorRuntimeAsJsenvImport } from "./internal/regenerator_runtime/babel_plugin_regenerator_runtime_as_jsenv_import.js";

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

  if (inputIsJsModule && babelHelpersAsImport) {
    if (!isSupported("global_this")) {
      babelPluginStructure["global-this-as-jsenv-import"] = [
        babelPluginGlobalThisAsJsenvImport,
        {
          getImportSpecifier,
        },
      ];
    }
    if (!isSupported("async_generator_function")) {
      babelPluginStructure["regenerator-runtime-as-jsenv-import"] = [
        babelPluginRegeneratorRuntimeAsJsenvImport,
        {
          getImportSpecifier,
        },
      ];
    }
    if (!isSupported("new_stylesheet")) {
      babelPluginStructure["new-stylesheet-as-jsenv-import"] = [
        babelPluginNewStylesheetAsJsenvImport,
        {
          getImportSpecifier,
        },
      ];
    }
    if (Object.keys(babelPluginStructure).length > 0) {
      babelPluginStructure["babel-helper-as-jsenv-import"] = [
        babelPluginBabelHelpersAsJsenvImports,
        {
          getImportSpecifier,
        },
      ];
    }
  }
  // otherwise, concerning global_this, and new_stylesheet we must inject the code
  // (we cannot inject an import)

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
