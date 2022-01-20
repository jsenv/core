import { findHighestVersion } from "@jsenv/core/src/internal/semantic_versioning/index.js"

import { featuresCompatMap } from "./features_compatibility.js"

export const createOneRuntimeCompat = ({
  runtimeName,
  runtimeVersion,
  featureNames,
}) => {
  const availableFeatureNames = []
  // "minRuntimeVersion" is the first version where all
  // features in "availableFeatureNames" where available
  // can be lower or equal to "runtimeVersion"
  let minRuntimeVersion
  featureNames.forEach((featureName) => {
    const featureCompat = featuresCompatMap[featureName] || {}
    const runtimeVersionCompatible = featureCompat[runtimeName] || "Infinity"
    const highestVersion = findHighestVersion(
      runtimeVersion,
      runtimeVersionCompatible,
    )
    const compatible = highestVersion === runtimeVersion
    if (compatible) {
      availableFeatureNames.push(featureName)
      if (runtimeVersionCompatible !== "Infinity") {
        // there is a version from which runtime becomes compatible with this feature
        minRuntimeVersion = findHighestVersion(
          minRuntimeVersion || "0.0.0",
          runtimeVersionCompatible,
        )
      }
    }
  })
  return {
    availableFeatureNames,
    minRuntimeVersion: minRuntimeVersion || runtimeVersion,
  }
}
