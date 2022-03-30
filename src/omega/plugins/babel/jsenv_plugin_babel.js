import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"

import { getBaseBabelPluginStructure } from "./utils/babel_plugin_structure.js"
import { babelPluginNewStylesheetAsJsenvImport } from "./new_stylesheet/babel_plugin_new_stylesheet_as_jsenv_import.js"
import { babelPluginGlobalThisAsJsenvImport } from "./global_this/babel_plugin_global_this_as_jsenv_import.js"
import { babelPluginRegeneratorRuntimeAsJsenvImport } from "./regenerator_runtime/babel_plugin_regenerator_runtime_as_jsenv_import.js"
import { babelPluginBabelHelpersAsJsenvImports } from "./babel_helper/babel_plugin_babel_helpers_as_jsenv_imports.js"

export const jsenvPluginBabel = ({ getCustomBabelPlugins } = {}) => {
  return {
    name: "jsenv:babel",
    appliesDuring: "*",
    transform: {
      js_module: async ({ url, generatedUrl, content }, context) => {
        const { isSupportedOnRuntime, addReference } = context
        const babelPluginStructure = getBaseBabelPluginStructure({
          url,
          isSupportedOnRuntime,
        })
        const getImportSpecifier = (clientFileUrl) =>
          JSON.parse(
            addReference({
              type: "js_import_export",
              specifier: clientFileUrl,
            }).generatedSpecifier,
          )

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
        if (getCustomBabelPlugins) {
          Object.assign(babelPluginStructure, getCustomBabelPlugins(context))
        }
        const babelPlugins = Object.keys(babelPluginStructure).map(
          (babelPluginName) => babelPluginStructure[babelPluginName],
        )
        if (babelPlugins.length) {
          babelPlugins.push([
            babelPluginBabelHelpersAsJsenvImports,
            {
              getImportSpecifier,
            },
          ])
        }
        const { code, map } = await applyBabelPlugins({
          babelPlugins,
          url,
          generatedUrl,
          content,
        })
        return {
          content: code,
          sourcemap: map,
        }
      },
      js_classic: async () => {
        // TODO (same but some babel plugins configured differently)
        // and forward that into to applyBabelPlugins
        return null
      },
    },
  }
}
