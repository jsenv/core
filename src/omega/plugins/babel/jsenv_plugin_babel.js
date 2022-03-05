import { applyBabelPlugins } from "@jsenv/core/src/utils/js_ast/apply_babel_plugins.js"

import { getBaseBabelPluginStructure } from "./babel_plugin_structure.js"
import { babelPluginImportAssertions } from "./import_assertions/babel_plugin_import_assertions.js"
import { convertCssTextToJavascriptModule } from "./import_assertions/css_module.js"
import { convertJsonTextToJavascriptModule } from "./import_assertions/json_module.js"
import { babelPluginNewStylesheetAsJsenvImport } from "./new_stylesheet/babel_plugin_new_stylesheet_as_jsenv_import.js"
import { babelPluginGlobalThisAsJsenvImport } from "./global_this/babel_plugin_global_this_as_jsenv_import.js"
import { babelPluginRegeneratorRuntimeAsJsenvImport } from "./regenerator_runtime/babel_plugin_regenerator_runtime_as_jsenv_import.js"
import { babelPluginBabelHelpersAsJsenvImports } from "./babel_helper/babel_plugin_babel_helpers_as_jsenv_imports.js"

export const jsenvPluginBabel = () => {
  const babel = {
    name: "jsenv:babel",
    appliesDuring: "*",
    transform: {
      js_module: async ({ isSupportedOnRuntime, url, content }) => {
        const babelPluginStructure = getBaseBabelPluginStructure({
          url,
          isSupportedOnRuntime,
        })
        const importTypes = []
        if (!isSupportedOnRuntime("import_type_json")) {
          importTypes.push("json")
        }
        if (!isSupportedOnRuntime("import_type_css")) {
          importTypes.push("css")
        }
        if (importTypes.length > 0) {
          babelPluginStructure["transform-import-assertions"] = [
            babelPluginImportAssertions,
            {
              importTypes,
            },
          ]
        }
        if (!isSupportedOnRuntime("global_this")) {
          babelPluginStructure["global-this-as-jsenv-import"] =
            babelPluginGlobalThisAsJsenvImport
        }
        if (!isSupportedOnRuntime("async_generator_function")) {
          babelPluginStructure["regenerator-runtime-as-jsenv-import"] =
            babelPluginRegeneratorRuntimeAsJsenvImport
        }
        if (!isSupportedOnRuntime("new_stylesheet")) {
          babelPluginStructure["new-stylesheet-as-jsenv-import"] =
            babelPluginNewStylesheetAsJsenvImport
        }
        const babelPlugins = Object.keys(babelPluginStructure).map(
          (babelPluginName) => babelPluginStructure[babelPluginName],
        )
        if (babelPlugins.length) {
          babelPlugins.push(babelPluginBabelHelpersAsJsenvImports)
        }
        const { code, map } = await applyBabelPlugins({
          babelPlugins,
          url,
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
  const importTypeJson = {
    name: "jsenv:import_type_json",
    appliesDuring: "*",
    render: ({ url, contentType, content }) => {
      if (!new URL(url).searchParams.has("json_module")) {
        return null
      }
      if (contentType !== "application/json") {
        throw new Error(
          `Unexpected content type on ${url}, should be "application/json" but got ${contentType}`,
        )
      }
      return convertJsonTextToJavascriptModule({
        content,
      })
    },
  }
  const importTypeCss = {
    name: "jsenv:import_type_css",
    appliesDuring: "*",
    render: ({ url, contentType, content }) => {
      if (!new URL(url).searchParams.has("css_module")) {
        return null
      }
      if (contentType !== "text/css") {
        throw new Error(
          `Unexpected content type on ${url}, should be "text/css" but got ${contentType}`,
        )
      }
      return convertCssTextToJavascriptModule({
        content,
      })
    },
  }
  // maybe add importTypeText:
  // - this would force babel to apply when we could skip it on recent browsers)
  // - but that's useful
  // - and I expect it to become available one day
  return [babel, importTypeJson, importTypeCss]
}
