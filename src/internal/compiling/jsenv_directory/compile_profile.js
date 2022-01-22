import { featuresCompatFromRuntime } from "@jsenv/core/src/internal/features/features_compat_from_runtime.js"

import { sameValueInTwoObjects } from "./comparison_utils.js"

const COMPARERS = {
  missingFeatures: sameValueInTwoObjects,
  moduleOutFormat: (a, b) => a === b,
  sourcemapMethod: (a, b) => a === b,
  sourcemapExcludeSources: (a, b) => a === b,
  jsenvEventSourceClientInjection: (a, b) => a === b,
  jsenvToolbarInjection: (a, b) => a === b,
}

export const createCompileProfile = ({
  workerUrls,
  babelPluginMapWithoutSyntax,
  importMapInWebWorkers,
  importDefaultExtension,
  moduleOutFormat,
  sourcemapMethod,
  sourcemapExcludeSources,
  jsenvEventSourceClientInjection,
  jsenvToolbarInjection,

  runtimeReport,
}) => {
  const { env = {} } = runtimeReport

  const features = {}
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
  if (importDefaultExtension) {
    features["import_default_extension"] = true
  }
  if (env.browser) {
    features["script_type_module"] = true
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

  const missingFeatures = {}
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
    } else {
      const systemJsIsRequired = featuresRelatedToSystemJs.some(
        (featureName) => {
          return Boolean(missingFeatures[featureName])
        },
      )
      moduleOutFormat = systemJsIsRequired ? "systemjs" : "esmodule"
    }
  }
  return {
    missingFeatures,
    moduleOutFormat,
    sourcemapMethod,
    sourcemapExcludeSources,
    jsenvEventSourceClientInjection,
    jsenvToolbarInjection,
  }
}

const featuresRelatedToSystemJs = [
  "script_type_module",
  "importmap",
  "import_assertion_type_json",
  "import_assertion_type_css",
  "worker_type_module",
  "worker_importmap",
]

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
      return {}
    }
    if (babelPluginValue.length === 2) {
      return babelPluginValue[1]
    }
    return {}
  }
  if (typeof babelPluginValue === "object") {
    return { options: babelPluginValue.options }
  }
  return {}
}
