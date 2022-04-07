import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"

import { getBaseBabelPluginStructure } from "./helpers/babel_plugin_structure.js"
import { babelPluginNewStylesheetAsJsenvImport } from "./new_stylesheet/babel_plugin_new_stylesheet_as_jsenv_import.js"
import { babelPluginGlobalThisAsJsenvImport } from "./global_this/babel_plugin_global_this_as_jsenv_import.js"
import { babelPluginRegeneratorRuntimeAsJsenvImport } from "./regenerator_runtime/babel_plugin_regenerator_runtime_as_jsenv_import.js"
import { babelPluginBabelHelpersAsJsenvImports } from "./babel_helper/babel_plugin_babel_helpers_as_jsenv_imports.js"

export const jsenvPluginBabel = ({
  getCustomBabelPlugins,
  topLevelAwait,
} = {}) => {
  const transformWithBabel = async (urlInfo, context) => {
    const isJsModule = urlInfo.type === "js_module"
    const isWorker =
      urlInfo.subtype === "worker" || urlInfo.subtype === "service_worker"
    const { isSupportedOnRuntime, referenceUtils } = context
    const babelPluginStructure = getBaseBabelPluginStructure({
      url: urlInfo.url,
      isSupportedOnRuntime,
      topLevelAwait,
      usesTopLevelAwait: urlInfo.data.usesTopLevelAwait,
      isJsModule,
      isWorker,
    })
    if (getCustomBabelPlugins) {
      Object.assign(babelPluginStructure, getCustomBabelPlugins(context))
    }

    if (isJsModule) {
      const getImportSpecifier = (clientFileUrl) => {
        const [reference] = referenceUtils.inject({
          type: "js_import_export",
          specifier: clientFileUrl,
        })
        return JSON.parse(reference.generatedSpecifier)
      }
      if (!isSupportedOnRuntime("global_this")) {
        babelPluginStructure["global-this-as-jsenv-import"] = [
          babelPluginGlobalThisAsJsenvImport,
          {
            getImportSpecifier,
          },
        ]
      }
      if (!isSupportedOnRuntime("async_generator_function")) {
        babelPluginStructure["regenerator-runtime-as-jsenv-import"] = [
          babelPluginRegeneratorRuntimeAsJsenvImport,
          {
            getImportSpecifier,
          },
        ]
      }
      if (!isSupportedOnRuntime("new_stylesheet")) {
        babelPluginStructure["new-stylesheet-as-jsenv-import"] = [
          babelPluginNewStylesheetAsJsenvImport,
          {
            getImportSpecifier,
          },
        ]
      }
      if (Object.keys(babelPluginStructure).length > 0) {
        babelPluginStructure["babel-helper-as-jsenv-import"] = [
          babelPluginBabelHelpersAsJsenvImports,
          {
            getImportSpecifier,
          },
        ]
      }
    }
    // otherwise, concerning global_this, and new_stylesheet we must inject the code
    // (we cannot inject an import)

    const babelPlugins = Object.keys(babelPluginStructure).map(
      (babelPluginName) => babelPluginStructure[babelPluginName],
    )
    const { code, map } = await applyBabelPlugins({
      babelPlugins,
      url: urlInfo.url,
      generatedUrl: urlInfo.generatedUrl,
      content: urlInfo.content,
    })
    return {
      content: code,
      sourcemap: map,
    }
  }

  return {
    name: "jsenv:babel",
    appliesDuring: "*",
    transform: {
      js_module: transformWithBabel,
      js_classic: transformWithBabel,
    },
  }
}
