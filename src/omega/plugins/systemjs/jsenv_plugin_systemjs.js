import { require } from "@jsenv/core/src/utils/require.js"
import { applyBabelPlugins } from "@jsenv/core/src/utils/js_ast/apply_babel_plugins.js"

export const jsenvPluginSystemJs = () => {
  return {
    name: "jsenv:systemjs",
    appliesDuring: {
      dev: true,
      test: true,
    },
    transform: {
      html: async () => {
        // TODO
        // inject systemjs as early as possible (if needed)
        // replace type="module" with regular tag using System.import
        return null
      },
      js_module: async (
        { url, generatedUrl, originalContent, content },
        { isSupportedOnRuntime, runtimeSupport },
      ) => {
        const shouldBeCompatibleWithNode =
          Object.keys(runtimeSupport).includes("node")
        const requiredFeatureNames = [
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
        const needsSystemJs = featuresRelatedToSystemJs.some((featureName) => {
          const isRequired = requiredFeatureNames.includes(featureName)
          return isRequired && !isSupportedOnRuntime(featureName)
        })
        if (!needsSystemJs) {
          return null
        }
        const { code, map } = await applyBabelPlugins({
          babelPlugins: [require("@babel/plugin-transform-modules-systemjs")],
          url,
          generatedUrl,
          originalContent,
          content,
        })
        return {
          content: code,
          soourcemap: map,
        }
      },
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
