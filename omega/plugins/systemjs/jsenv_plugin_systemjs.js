import { featuresCompatFromRuntimeSupport } from "@jsenv/core/src/internal/features/features_compat_from_runtime_support.js"
import { require } from "@jsenv/core/src/internal/require.js"
import { babelTransform } from "@jsenv/core/src/internal/transform_js/babel_transform.js"

export const jsenvPluginSystemJs = () => {
  return {
    name: "jsenv:systemjs",
    appliesDuring: {
      dev: true,
      test: true,
      preview: false,
      prod: false,
    },

    transform: async ({ runtimeSupport, url, contentType, content }) => {
      const isHtml = contentType === "text/html"
      if (isHtml) {
        // TODO
        return null
      }
      const isJsModule =
        contentType === "application/javascript" &&
        !new URL(url).searchParams.get("script")
      if (isJsModule) {
        const requiredFeatureNames = [
          // todo
        ]
        const needsSystemJs = featuresRelatedToSystemJs.some((featureName) => {
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
            plugins: [[require("@babel/plugin-transform-modules-systemjs")]],
          },
          url,
          content,
        })
        return {
          content: code,
          soourcemap: map,
        }
      }
      return null
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
