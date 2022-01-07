import { findHighestVersion } from "../semantic_versioning/index.js"

export const createOneRuntimeCompat = ({
  runtimeName,
  runtimeVersion,
  featureNames,
  featuresCompatMap,
}) => {
  const missingFeatureNames = []
  // will be the first runtime version compatible with all features not listed in
  // missingFeatureNames
  let minRuntimeVersion
  featureNames.forEach((featureName) => {
    const featureCompat = featuresCompatMap[featureName] || {}
    const runtimeVersionCompatible = featureCompat[runtimeName] || "Infinity"

    const highestVersion = findHighestVersion(
      runtimeVersion,
      runtimeVersionCompatible,
    )
    const compatible = highestVersion === runtimeVersion
    if (!compatible) {
      missingFeatureNames.push(featureName)
    }

    if (compatible && runtimeVersionCompatible !== "Infinity") {
      // there is a version from which runtime becomes compatible with this feature
      minRuntimeVersion = findHighestVersion(
        minRuntimeVersion || "0.0.0",
        runtimeVersionCompatible,
      )
    }
  })
  return {
    missingFeatureNames,
    minRuntimeVersion: minRuntimeVersion || runtimeVersion,
  }
}
