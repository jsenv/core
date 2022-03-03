import { findHighestVersion } from "@jsenv/core/src/internal/semantic_versioning/highest_version.js"

import { featuresCompatMap } from "./features_compatibility.js"

export const isFeatureSupportedOnRuntimes = (runtimeSupport, featureName) => {
  const runtimeNames = Object.keys(runtimeSupport)
  return runtimeNames.every((runtimeName) => {
    const runtimeVersion = runtimeSupport[runtimeName]
    const featureCompat = featuresCompatMap[featureName] || {}
    const runtimeVersionCompatible = featureCompat[runtimeName] || "Infinity"
    const highestVersion = findHighestVersion(
      runtimeVersion,
      runtimeVersionCompatible,
    )
    return highestVersion === runtimeVersion
  })
}
