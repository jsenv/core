import { applyBabelPlugins } from "@jsenv/ast";

import { getBaseBabelPluginStructure } from "./babel_plugin_structure.js";
import { babelPluginBabelHelpersAsJsenvImports } from "./babel_plugin_babel_helpers_as_jsenv_imports.js";
import { analyzeRegeneratorRuntimeUsage } from "./regenerator_runtime/regenerator_runtime_usage.js";
import { babelPluginRegeneratorRuntimeInjector } from "./regenerator_runtime/babel_plugin_regenerator_runtime_injector.js";
import { regeneratorRuntimeClientFileUrl } from "./regenerator_runtime/regenerator_runtime_client_file_url.js";
import { analyzeConstructableStyleSheetUsage } from "./new_stylesheet/constructable_stylesheet_usage.js";
import { babelPluginNewStylesheetInjector } from "./new_stylesheet/babel_plugin_new_stylesheet_injector.js";

export const jsenvPluginBabel = ({ babelHelpersAsImport = true } = {}) => {
  const transformWithBabel = async (urlInfo, context) => {
    const isJsModule = urlInfo.type === "js_module";
    const getImportSpecifier = (clientFileUrl) => {
      const jsImportReference = urlInfo.dependencies.inject({
        type: "js_import",
        expectedType: "js_module",
        specifier: clientFileUrl,
      });
      return JSON.parse(jsImportReference.generatedSpecifier);
    };
    const isSupported = context.isSupportedOnCurrentClients;
    const babelPluginStructure = getBaseBabelPluginStructure({
      url: urlInfo.originalUrl,
      isSupported,
      isJsModule,
      getImportSpecifier,
    });

    if (!isSupported("async_generator_function")) {
      const regeneratorRuntimeUsage = analyzeRegeneratorRuntimeUsage(urlInfo);
      if (regeneratorRuntimeUsage) {
        if (isJsModule && babelHelpersAsImport) {
          babelPluginStructure["new-stylesheet-injector"] = [
            babelPluginRegeneratorRuntimeInjector,
            { babelHelpersAsImport, getImportSpecifier },
          ];
        } else {
          urlInfo.dependencies.foundSideEffectFile({
            sideEffectFileUrl: regeneratorRuntimeClientFileUrl,
            expectedType: "js_classic",
            specifierLine: regeneratorRuntimeUsage.line,
            specifierColumn: regeneratorRuntimeUsage.column,
          });
        }
      }
    }
    if (!isSupported("new_stylesheet")) {
      const constructableStyleSheetUsage =
        analyzeConstructableStyleSheetUsage(urlInfo);
      if (constructableStyleSheetUsage) {
        if (isJsModule && babelHelpersAsImport) {
          babelPluginStructure["new-stylesheet-injector"] = [
            babelPluginNewStylesheetInjector,
            { babelHelpersAsImport, getImportSpecifier },
          ];
        } else {
          urlInfo.dependencies.foundSideEffectFile({
            sideEffectFileUrl: regeneratorRuntimeClientFileUrl,
            expectedType: "js_classic",
            specifierLine: constructableStyleSheetUsage.line,
            specifierColumn: constructableStyleSheetUsage.column,
          });
        }
      }
    }
    if (
      isJsModule &&
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
      options: {
        generatorOpts: {
          retainLines: context.dev,
        },
      },
      input: urlInfo.content,
      inputIsJsModule: isJsModule,
      inputUrl: urlInfo.originalUrl,
      outputUrl: urlInfo.generatedUrl,
    });
    return {
      content: code,
      sourcemap: map,
    };
  };

  return {
    name: "jsenv:babel",
    appliesDuring: "*",
    transformUrlContent: {
      js_classic: transformWithBabel,
      js_module: transformWithBabel,
    },
  };
};
