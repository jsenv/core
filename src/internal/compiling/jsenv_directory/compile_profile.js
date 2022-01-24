import { featuresCompatFromRuntime } from "@jsenv/core/src/internal/features/features_compat_from_runtime.js"

import { sameValueInTwoObjects } from "./comparison_utils.js"

const COMPARERS = {
  missingFeatures: sameValueInTwoObjects,
  preservedUrls: sameValueInTwoObjects,
  moduleOutFormat: (a, b) => a === b,
  sourcemapMethod: (a, b) => a === b,
  sourcemapExcludeSources: (a, b) => a === b,
  jsenvEventSourceClientInjection: (a, b) => a === b,
  jsenvToolbarInjection: (a, b) => a === b,
}

export const createCompileProfile = ({
  importDefaultExtension,
  preservedUrls,
  customCompilers,
  babelPluginMapWithoutSyntax,
  workerUrls,
  importMapInWebWorkers,
  moduleOutFormat,
  sourcemapMethod,
  sourcemapExcludeSources,
  jsenvEventSourceClientInjection,
  jsenvToolbarInjection,

  runtimeReport,
}) => {
  const { env = {} } = runtimeReport

  const features = {}
  if (importDefaultExtension) {
    features["import_default_extension"] = true
  }
  const customCompilerPatterns = Object.keys(customCompilers)
  if (customCompilerPatterns.length > 0) {
    features["custom_compiler_patterns"] = customCompilerPatterns
  }
  Object.keys(babelPluginMapWithoutSyntax).forEach((babelPluginName) => {
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
      babelPluginMapWithoutSyntax[babelPluginName],
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
  if (env.browser && workerUrls.length > 0) {
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
  Object.keys(featureEffects).forEach((featureName) => {
    if (featuresReport[featureName]) {
      featureEffects[featureName]({
        supportedFeatureNames,
      })
    }
  })

  const missingFeatures = {}
  if (!runtimeReport.forceSource) {
    featureNames.forEach((featureName) => {
      const supported = supportedFeatureNames.includes(featureName)
      if (supported) {
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
    preservedUrls,
    moduleOutFormat,
    sourcemapMethod,
    sourcemapExcludeSources,
    jsenvEventSourceClientInjection,
    jsenvToolbarInjection,
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
    if (missingFeatures[babelPluginName]) {
      babelPluginMapShaked[babelPluginName] = babelPluginMap[babelPluginName]
    }
  })
  Object.keys(babelPluginMap).forEach((key) => {
    if (key.startsWith("syntax-")) {
      babelPluginMapShaked[key] = babelPluginMap[key]
    }
    if (key === "transform-replace-expressions") {
      babelPluginMapShaked[key] = babelPluginMap[key]
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
