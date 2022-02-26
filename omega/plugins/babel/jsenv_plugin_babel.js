import { require } from "@jsenv/core/src/internal/require.js"
import { featuresCompatFromRuntimeSupport } from "@jsenv/core/src/internal/features/features_compat_from_runtime_support.js"
import { babelTransform } from "@jsenv/core/src/internal/transform_js/babel_transform.js"

import { transformReplaceExpressions } from "./jsenv_babel_plugins/transform_replace_expressions.js"
import { transformImportMeta } from "./jsenv_babel_plugins/transform_import_meta.js"
import { getBaseBabelPluginStructure } from "./babel_plugin_base.js"
import { getRuntimeBabelPluginStructure } from "./babel_plugin_runtime.js"

export const jsenvPluginBabel = () => {
  const baseBabelPluginStructure = getBaseBabelPluginStructure()

  return {
    name: "jsenv_babel",

    appliesDuring: {
      dev: true,
      test: true,
      build: true,
    },

    transform: async ({
      scenario,
      runtimeSupport,
      url,
      contentType,
      content,
      ast,
    }) => {
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

      const jsenvBabelPluginStructure = {
        // sometimes code use things specific to Node.js even if it's meant to run
        // in a browser
        "transform-replace-expressions": [
          transformReplaceExpressions,
          {
            replaceMap: {
              "process.env.NODE_ENV": `("${
                scenario === "dev" || scenario === "test" ? "dev" : "prod"
              }")`,
              "global": "globalThis",
              "__filename": `import.meta.url.slice('file:///'.length)`,
              "__dirname": `import.meta.url.slice('file:///'.length).replace(/[\\\/\\\\][^\\\/\\\\]*$/, '')`,
            },
            allowConflictingReplacements: true,
          },
        ],
        "transform-import-meta": [
          transformImportMeta,
          {
            importMetaFormat: "esmodule",
            importMetaHot: scenario === "dev",
          },
        ],
      }
      const babelPluginStructure = {
        ...baseBabelPluginStructure,
        ...jsenvBabelPluginStructure,
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
      const { code, map } = await babelTransform({
        options: {
          plugins: Object.keys(babelPluginStructureForRuntime).map(
            (babelPluginName) =>
              babelPluginStructureForRuntime[babelPluginName],
          ),
        },
        url,
        ast,
        content,
      })
      return {
        content: code,
        sourcemap: map,
        finalize: async ({ content }) => {
          const needsSystemJs =
            (scenario === "dev" || scenario === "test") &&
            featuresRelatedToSystemJs.some((featureName) => {
              const isRequired = requiredFeatureNames.includes(featureName)
              const isAvailable = featuresCompatFromRuntimeSupport({
                featureNames: [featureName],
                runtimeSupport,
              }).availableFeatureNames.includes(featureName)
              return isRequired && !isAvailable
            })
          if (!needsSystemJs) {
            return null
          }
          const { code, map } = await babelTransform({
            options: {
              plugins: [
                [require("@babel/plugin-transform-modules-systemjs")],
                [
                  transformImportMeta,
                  {
                    importMetaFormat: "systemjs",
                  },
                ],
              ],
            },
            url,
            ast,
            content,
          })
          return {
            content: code,
            soourcemap: map,
          }
        },
      }
    },
  }
}

const featuresRelatedToSystemJs = [
  "script_type_module",
  "worker_type_module",
  "import_dynamic",
  "import_type_json",
  "import_type_css",
  "top_level_await",
  // "importmap",
  // "worker_importmap",
]
