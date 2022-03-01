import { featuresCompatFromRuntimeSupport } from "@jsenv/core/src/internal/features/features_compat_from_runtime_support.js"
import { babelTransform } from "@jsenv/core/src/internal/transform_js/babel_transform.js"

import { getBaseBabelPluginStructure } from "./babel_plugin_base.js"
import { getRuntimeBabelPluginStructure } from "./babel_plugin_runtime.js"

export const jsenvPluginBabel = () => {
  const babelPluginStructure = {
    ...getBaseBabelPluginStructure(),
  }

  return {
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
}
