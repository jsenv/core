import { featuresCompatFromRuntime } from "@jsenv/core/src/internal/features/features_compat_from_runtime.js"
import { featuresCompatFromRuntimeSupport } from "@jsenv/core/src/internal/features/features_compat_from_runtime_support.js"
import { isBabelPluginForJsenv } from "@jsenv/core/src/internal/compile_server/js/babel_plugin_map.js"

import { sameValueInTwoObjects } from "./comparison_utils.js"

const COMPARERS = {
  missingFeatures: sameValueInTwoObjects,
  moduleOutFormat: (a, b) => a === b,
  sourcemapMethod: (a, b) => a === b,
  sourcemapExcludeSources: (a, b) => a === b,

  eventSourceClient: (a, b) => a === b,
  htmlSupervisor: (a, b) => a === b,
  toolbar: (a, b) => a === b,
}

export const createCompileProfile = ({
  importDefaultExtension,
  customCompilers,
  babelPluginMap,
  importMapInWebWorkers,
  moduleOutFormat,
  sourcemapMethod,
  sourcemapExcludeSources,

  eventSourceClient,
  htmlSupervisor,
  toolbar,

  runtimeReport,
}) => {
  const { env = {} } = runtimeReport

  const features = {}
  if (importDefaultExtension) {
    features["import_default_extension"] = true
  }
  features.global_this = true
  features.async_generator_function = Boolean(
    babelPluginMap["transform-async-to-generator"],
  )
  const customCompilerPatterns = Object.keys(customCompilers)
  if (customCompilerPatterns.length > 0) {
    features["custom_compiler_patterns"] = customCompilerPatterns
  }
  Object.keys(babelPluginMap).forEach((babelPluginName) => {
    // if we need to be compatible only with node
    // ignore "new-stylesheet-as-jsenv-import" and "transform-import-assertions"
    // (we consider they won't be used in the code we are about to execute)
    if (env.node && !env.browser) {
      if (
        babelPluginName === "new-stylesheet-as-jsenv-import" ||
        babelPluginName === "transform-import-assertions"
      ) {
        return
      }
    }
    features[babelPluginName] = babelPluginValueAsJSON(
      babelPluginMap[babelPluginName],
    )
  })

  if (env.browser) {
    Object.assign(features, {
      script_type_module: true,
      import_dynamic: true,
      top_level_await: true,
      importmap: true,
      import_assertion_type_json: true,
      import_assertion_type_css: true,
    })
  }
  if (env.browser) {
    features["worker_type_module"] = true
  }
  if (env.browser && importMapInWebWorkers) {
    features["worker_importmap"] = true
  }
  const featureNames = Object.keys(features)

  const supportedFeatureNames = []
  const { featuresReport = {} } = runtimeReport
  Object.keys(featuresReport).forEach((featureName) => {
    if (featuresReport[featureName]) {
      supportedFeatureNames.push(featureName)
    }
  })
  const { name, version } = runtimeReport
  if (name && version) {
    const { availableFeatureNames } = featuresCompatFromRuntime({
      runtimeName: name,
      runtimeVersion: version,
      featureNames,
    })
    availableFeatureNames.forEach((featureName) => {
      const runtimeReportResult = featuresReport[featureName]
      if (runtimeReportResult === undefined) {
        supportedFeatureNames.push(featureName)
      }
    })
  }
  const { runtimeSupport } = runtimeReport
  if (runtimeSupport) {
    const { availableFeatureNames } = featuresCompatFromRuntimeSupport({
      runtimeSupport,
      featureNames,
    })
    availableFeatureNames.forEach((featureName) => {
      const runtimeReportResult = featuresReport[featureName]
      if (runtimeReportResult === undefined) {
        supportedFeatureNames.push(featureName)
      }
    })
  }
  Object.keys(featureEffects).forEach((featureName) => {
    if (supportedFeatureNames.includes(featureName)) {
      featureEffects[featureName]({
        supportedFeatureNames,
      })
    }
  })
  if (
    supportedFeatureNames.includes("import_assertion_type_json") &&
    supportedFeatureNames.includes("import_assertion_type_css")
  ) {
    supportedFeatureNames.push("syntax-import-assertions")
    supportedFeatureNames.push("transform-import-assertions")
  }

  const missingFeatures = {}
  if (!runtimeReport.forceSource) {
    featureNames.forEach((featureName) => {
      const supported = supportedFeatureNames.includes(featureName)
      if (supported) {
        return
      }
      if (isBabelPluginForJsenv(featureName)) {
        return
      }
      missingFeatures[featureName] = features[featureName]
    })
    if (moduleOutFormat === undefined) {
      if (runtimeReport.moduleOutFormat) {
        moduleOutFormat = runtimeReport.moduleOutFormat
        if (moduleOutFormat !== "esmodule") {
          missingFeatures["module_format"] = moduleOutFormat
        }
      } else {
        const systemJsIsRequired =
          featuresRelatedToSystemJs.some((featureName) => {
            return Boolean(missingFeatures[featureName])
          }) || !featuresReport["import_http"]
        moduleOutFormat = systemJsIsRequired ? "systemjs" : "esmodule"
      }
    }
    if (runtimeReport.forceCompilation) {
      missingFeatures["compilation_forced"] = true
    }
  }
  return {
    missingFeatures,
    moduleOutFormat,
    sourcemapMethod,
    sourcemapExcludeSources,

    eventSourceClient,
    htmlSupervisor,
    toolbar,
  }
}

const featuresRelatedToSystemJs = [
  "script_type_module",
  "import_dynamic",
  "top_level_await",
  "importmap",
  "import_assertion_type_json",
  "import_assertion_type_css",
  "worker_type_module",
  "worker_importmap",
]

const featureEffects = {
  coverage_js: ({ supportedFeatureNames }) => {
    supportedFeatureNames.push("transform-instrument")
  },
  new_stylesheet: ({ supportedFeatureNames }) => {
    supportedFeatureNames.push("new-stylesheet-as-jsenv-import")
  },
  global_this: ({ supportedFeatureNames }) => {
    supportedFeatureNames.push("global-this-as-jsenv-import")
  },
  async_generator_function: ({ supportedFeatureNames }) => {
    supportedFeatureNames.push("regenerator-runtime-as-jsenv-import")
  },
}

export const compareCompileProfiles = (
  compileProfile,
  secondCompileProfile,
) => {
  return Object.keys(COMPARERS).every((key) => {
    return COMPARERS[key](compileProfile[key], secondCompileProfile[key])
  })
}

export const shakeBabelPluginMap = ({ babelPluginMap, compileProfile }) => {
  const babelPluginMapShaked = {}
  const { missingFeatures } = compileProfile
  Object.keys(babelPluginMap).forEach((babelPluginName) => {
    if (
      missingFeatures[babelPluginName] ||
      isBabelPluginForJsenv(babelPluginName)
    ) {
      babelPluginMapShaked[babelPluginName] = babelPluginMap[babelPluginName]
    }
  })
  return babelPluginMapShaked
}

const babelPluginValueAsJSON = (babelPluginValue) => {
  if (Array.isArray(babelPluginValue)) {
    if (babelPluginValue.length === 1) {
      return true
    }
    if (babelPluginValue.length === 2) {
      return babelPluginValue[1]
    }
    return true
  }
  if (typeof babelPluginValue === "object") {
    return babelPluginValue.options
  }
  return true
}
