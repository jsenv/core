import { featuresCompatFromRuntimeSupport } from "@jsenv/core/src/internal/features/features_compat_from_runtime_support.js"
import { babelTransform } from "@jsenv/core/src/internal/transform_js/babel_transform.js"

import {
  getBaseBabelPluginStructure,
  getRuntimeBabelPluginStructure,
} from "./babel_plugin_structure.js"
import { babelPluginImportAssertions } from "./jsenv_babel_plugins/import_assertions.js"
import { convertCssTextToJavascriptModule } from "./css_module.js"
import { convertJsonTextToJavascriptModule } from "./json_module.js"

export const jsenvPluginBabel = () => {
  const babelPluginStructureBase = getBaseBabelPluginStructure()

  const babel = {
    name: "jsenv:babel",
    appliesDuring: {
      dev: true,
      test: true,
      preview: true,
      prod: true,
    },

    transform: async ({ runtimeSupport, url, contentType, content }) => {
      if (contentType !== "application/javascript") {
        return null
      }
      const shouldBeCompatibleWithNode =
        Object.keys(runtimeSupport).includes("node")
      const baseFeatureNames = [
        "import_dynamic",
        "top_level_await",
        "global_this",
        // when using node we assume the code won't use browser specific feature
        ...(shouldBeCompatibleWithNode
          ? []
          : [
              "script_type_module",
              "worker_type_module",
              "import_type_json",
              "import_type_css",
            ]),
        // "importmap",
      ]
      const babelPluginStructure = {
        ...babelPluginStructureBase,
        "transform-import-assertions": [
          babelPluginImportAssertions,
          {
            transformJson: true, // should depend on support
            transformCss: true,
          },
        ],
      }
      const requiredFeatureNames = [
        ...baseFeatureNames,
        ...Object.keys(babelPluginStructure),
      ]
      const { availableFeatureNames } = featuresCompatFromRuntimeSupport({
        featureNames: requiredFeatureNames,
        runtimeSupport,
      })
      if (availableFeatureNames.includes("global_this")) {
        delete babelPluginStructure["global-this-as-jsenv-import"]
      }
      if (availableFeatureNames.includes("async_generator_function")) {
        delete babelPluginStructure["regenerator-runtime-as-jsenv-import"]
      }
      if (availableFeatureNames.includes("new_stylesheet")) {
        delete babelPluginStructure["new-stylesheet-as-jsenv-import"]
      }
      if (
        availableFeatureNames.includes("import_type_json") &&
        availableFeatureNames.includes("import_type_css")
      ) {
        delete babelPluginStructure["transform-import-assertions"]
      }
      const babelPluginStructureForRuntime = getRuntimeBabelPluginStructure({
        babelPluginStructure,
        availableFeatureNames,
      })
      const babelPlugins = Object.keys(babelPluginStructureForRuntime).map(
        (babelPluginName) => babelPluginStructureForRuntime[babelPluginName],
      )
      if (babelPlugins.length === 0) {
        return null
      }
      const { code, map } = await babelTransform({
        options: {
          plugins: babelPlugins,
        },
        url,
        content,
      })
      return {
        content: code,
        sourcemap: map,
      }
    },
  }

  const importTypeCss = {
    name: "jsenv:import_type_css",
    appliesDuring: {
      dev: true,
      test: true,
      preview: true,
      prod: true,
    },
    transform: ({ url, contentType, content }) => {
      if (contentType !== "text/css") {
        return null
      }
      if (new URL(url).searchParams.get("import_type") !== "css") {
        return null
      }
      return convertCssTextToJavascriptModule({
        url,
        content,
      })
    },
  }

  const importTypeJson = {
    name: "jsenv:import_type_json",
    appliesDuring: {
      dev: true,
      test: true,
      preview: true,
      prod: true,
    },
    transform: ({ url, contentType, content }) => {
      if (contentType !== "application/json") {
        return null
      }
      if (new URL(url).searchParams.get("import_type") !== "json") {
        return null
      }
      return convertJsonTextToJavascriptModule({
        content,
      })
    },
  }

  return [babel, importTypeCss, importTypeJson]
}
