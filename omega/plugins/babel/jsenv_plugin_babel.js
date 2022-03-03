import { applyBabelPlugins } from "#omega/internal/babel_utils/apply_babel_plugins.js"

import { getBaseBabelPluginStructure } from "./babel_plugin_structure.js"
import { babelPluginImportAssertions } from "./jsenv_babel_plugins/import_assertions.js"
import { convertCssTextToJavascriptModule } from "./css_module.js"
import { convertJsonTextToJavascriptModule } from "./json_module.js"

export const jsenvPluginBabel = () => {
  const babel = {
    name: "jsenv:babel",
    appliesDuring: "*",
    transform: {
      js_module: async ({ isSupportedOnRuntime, url, content }) => {
        const babelPluginStructure = getBaseBabelPluginStructure({
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
          babelPluginStructure["global-this-as-jsenv-import"] = null // TODO
        }
        if (!isSupportedOnRuntime("async_generator_function")) {
          babelPluginStructure["regenerator-runtime-as-jsenv-import"] = null // TODO
        }
        if (!isSupportedOnRuntime("new_stylesheet")) {
          babelPluginStructure["new-stylesheet-as-jsenv-import"] = null // TODO
        }
        const babelPlugins = Object.keys(babelPluginStructure).map(
          (babelPluginName) => babelPluginStructure[babelPluginName],
        )
        if (babelPlugins.length === 0) {
          return null
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
    },
  }
  const importTypeJson = {
    name: "jsenv:import_type_json",
    appliesDuring: "*",
    transform: ({ url, content }) => {
      if (new URL(url).searchParams.get("import_type") !== "json") {
        return null
      }
      return convertJsonTextToJavascriptModule({
        content,
      })
    },
  }
  const importTypeCss = {
    name: "jsenv:import_type_css",
    appliesDuring: "*",
    transform: ({ url, content }) => {
      if (new URL(url).searchParams.get("import_type") !== "css") {
        return null
      }
      return convertCssTextToJavascriptModule({
        url,
        content,
      })
    },
  }
  // maybe add importTypeText
  return [babel, importTypeJson, importTypeCss]
}
