import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"

import { RUNTIME_SUPPORT } from "@jsenv/core/src/omega/runtime_support/runtime_support.js"
import { getBaseBabelPluginStructure } from "./helpers/babel_plugin_structure.js"
import { babelPluginBabelHelpersAsJsenvImports } from "./helpers/babel_plugin_babel_helpers_as_jsenv_imports.js"
import { babelPluginNewStylesheetAsJsenvImport } from "./new_stylesheet/babel_plugin_new_stylesheet_as_jsenv_import.js"
import { babelPluginGlobalThisAsJsenvImport } from "./global_this/babel_plugin_global_this_as_jsenv_import.js"
import { babelPluginRegeneratorRuntimeAsJsenvImport } from "./regenerator_runtime/babel_plugin_regenerator_runtime_as_jsenv_import.js"

export const jsenvPluginBabel = ({
  getCustomBabelPlugins,
  topLevelAwait,
} = {}) => {
  const transformWithBabel = async (urlInfo, context) => {
    const isJsModule = urlInfo.type === "js_module"
    const isWorker = urlInfo.subtype === "worker"
    const isServiceWorker = urlInfo.subtype === "service_worker"
    const isWorkerContext = isWorker || isServiceWorker
    let { runtimeSupport } = context
    if (isServiceWorker) {
      // when code is executed by a service worker we can assume
      // the execution context supports more than the default one
      // for instance arrow function are supported
      runtimeSupport = RUNTIME_SUPPORT.add(runtimeSupport, "service_worker")
    }
    if (isWorker) {
      runtimeSupport = RUNTIME_SUPPORT.add(runtimeSupport, "worker")
    }
    const { referenceUtils } = context
    const isSupportedOnRuntime = (feature) =>
      RUNTIME_SUPPORT.isSupported(runtimeSupport, feature)
    const babelPluginStructure = getBaseBabelPluginStructure({
      url: urlInfo.url,
      isSupportedOnRuntime,
      topLevelAwait,
      usesTopLevelAwait: urlInfo.data.usesTopLevelAwait,
      isJsModule,
      isWorkerContext,
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
