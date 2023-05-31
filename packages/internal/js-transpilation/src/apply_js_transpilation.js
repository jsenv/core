import { applyBabelPlugins } from "@jsenv/ast";

import { getBaseBabelPluginStructure } from "./internal/babel_plugin_structure.js";
import { babelPluginBabelHelpersAsJsenvImports } from "./internal/babel_plugin_babel_helpers_as_jsenv_imports.js";
import { babelPluginNewStylesheetAsJsenvImport } from "./internal/new_stylesheet/babel_plugin_new_stylesheet_as_jsenv_import.js";
import { babelPluginGlobalThisAsJsenvImport } from "./internal/global_this/babel_plugin_global_this_as_jsenv_import.js";
import { babelPluginRegeneratorRuntimeAsJsenvImport } from "./internal/regenerator_runtime/babel_plugin_regenerator_runtime_as_jsenv_import.js";

export const applyJsTranspilation = async ({
  source,
  sourceType,
  sourceUrl,
  generatedUrl,
  getCustomBabelPlugins,
  babelHelpersAsImport = true,
  babelOptions,
  isSupported,
  getImportSpecifier,
}) => {
  const babelPluginStructure = getBaseBabelPluginStructure({
    url: sourceUrl,
    isSupported,
    isJsModule: sourceType === "module",
    getImportSpecifier,
  });
  if (getCustomBabelPlugins) {
    Object.assign(babelPluginStructure, getCustomBabelPlugins(context));
  }

  if (sourceType === "module" && babelHelpersAsImport) {
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
    sourceType,
    source,
    sourceUrl,
    generatedUrl,
  });
  return {
    content: code,
    sourcemap: map,
  };
};
