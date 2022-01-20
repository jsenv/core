import { featuresCompatFromRuntime } from "./features_compat_from_runtime.js"

export const getOrCreateCompileDirectory = ({
  featureNames,
  runtimeReport,
  compileDirectories,
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
  const allFeaturesSupported = featureNames.every((featureName) =>
    Boolean(featuresReport[featureName]),
  )
  if (allFeaturesSupported) {
    return null
  }
  const existingCompileIds = Object.keys(compileDirectories)
  const existingCompileId = existingCompileIds.find((compileIdCandidate) => {
    const compileDirectoryCandidate = compileDirectories[compileIdCandidate]
    return Object.keys(featuresReport).every(
      (featureName) =>
        featuresReport[featureName] ===
        compileDirectoryCandidate.featureReport[featureName],
    )
  })
  if (existingCompileId) {
    return existingCompileId
  }
  const compileIdBase = generateCompileId({
    runtimeName,
    runtimeVersion,
    featureNames,
  })
  let compileId = compileIdBase
  let integer = 1
  while (existingCompileIds.includes(compileId)) {
    compileId = `${compileIdBase}${integer}`
    integer++
  }
  compileDirectories[compileId] = {
    featuresReport,
  }
  return compileId
}

const generateCompileId = ({ runtimeName, runtimeVersion, featureNames }) => {
  if (featureNames.includes("transform-instrument")) {
    return `${runtimeName}_${runtimeVersion}_cov`
  }
  return `${runtimeName}_${runtimeVersion}`
}
