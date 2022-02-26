import { featuresCompatFromRuntimeSupport } from "@jsenv/core/src/internal/features/features_compat_from_runtime_support.js"
import { babelTransform } from "@jsenv/core/src/internal/transform_js/babel_transform.js"

import { getBaseBabelPluginStructure } from "./babel_plugin_base.js"
import { getJsenvBabelPluginStructure } from "./babel_plugin_jsenv.js"
import { getRuntimeBabelPluginStructure } from "./babel_plugin_runtime.js"

export const jsenvPluginBabel = () => {
  const baseBabelPluginStructure = getBaseBabelPluginStructure()
  const jsenvBabelPluginStructure = getJsenvBabelPluginStructure()
  const babelPluginStructure = {
    ...baseBabelPluginStructure,
    ...jsenvBabelPluginStructure,
  }
  const featureNames = Object.keys(babelPluginStructure)

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
      const { availableFeatureNames } = featuresCompatFromRuntimeSupport({
        featureNames,
        runtimeSupport,
      })
      const babelPluginStructureForRuntime = getRuntimeBabelPluginStructure({
        babelPluginStructure,
        availableFeatureNames,
        options: {
          "transform-replace-expressions": {
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
        },
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
      }
    },

    render: () => {
      // if needed do the transformation to systemjs
    },
  }
}
