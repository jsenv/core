import {
  sameValueInTwoObjects,
  sameValuesInTwoArrays,
} from "./comparison_utils.js"
import { featuresCompatFromRuntime } from "./features_compat_from_runtime.js"

export const createCompileProfile = ({
  moduleOutFormat,
  featureNames,
  babelPluginMap,
  sourcemapMethod,
  sourcemapExcludeSources,
  runtimeReport,
}) => {
  const runtimeName = runtimeReport.runtime.name
  const runtimeVersion = runtimeReport.runtime.version
  const { availableFeatureNames } = featuresCompatFromRuntime({
    runtimeName,
    runtimeVersion,
    featureNames,
  })
  const featuresReport = {}
  availableFeatureNames.forEach((availableFeatureName) => {
    featuresReport[availableFeatureName] = true
  })
  Object.assign(featuresReport, runtimeReport.featuresReport)
  const requiredBabelPluginDescription = {}
  Object.keys(babelPluginMap).forEach((babelPluginName) => {
    const supported = featuresReport[babelPluginName]
    if (!supported) {
      requiredBabelPluginDescription[babelPluginName] = babelPluginValueAsJSON(
        babelPluginMap[babelPluginName],
      )
    }
  })
  const requiredFeatureNames = featureNames.filter((featureName) => {
    return !featuresReport[featureName]
  })
  if (moduleOutFormat === undefined) {
    const systemJsIsRequired = featuresRelatedToSystemJs.some((featureName) => {
      return (
        // feature is used
        featureNames.includes(featureName) &&
        // and not supported
        !featuresReport[featureName]
      )
    })
    moduleOutFormat = systemJsIsRequired ? "systemjs" : "esmodule"
  }
  return {
    moduleOutFormat,
    requiredFeatureNames,
    requiredBabelPluginDescription,
    sourcemapMethod,
    sourcemapExcludeSources,
  }
}

export const shakeBabelPluginMap = ({ babelPluginMap, compileProfile }) => {
  const babelPluginMapShaked = {}
  const { requiredBabelPluginDescription } = compileProfile
  Object.keys(babelPluginMap).forEach((babelPluginName) => {
    if (!requiredBabelPluginDescription[babelPluginName]) {
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

const featuresRelatedToSystemJs = [
  "module",
  "importmap",
  "import_assertion_type_json",
  "import_assertion_type_css",
  "worker_type_module",
  "worker_importmap",
]

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

const COMPARERS = {
  moduleOutFormat: (a, b) => a === b,
  requiredFeatureNames: sameValuesInTwoArrays,
  requiredBabelPluginDescription: sameValueInTwoObjects,
  sourcemapMethod: (a, b) => a === b,
  sourcemapExcludeSources: (a, b) => a === b,
}

export const compareCompileProfiles = (
  compileProfile,
  secondCompileProfile,
) => {
  return Object.keys(COMPARERS).every((key) => {
    return COMPARERS[key](compileProfile[key], secondCompileProfile[key])
  })
}
