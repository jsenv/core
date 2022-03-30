import { findHighestVersion } from "@jsenv/utils/semantic_versioning/highest_version.js"

export const isFeatureSupportedOnRuntimes = (
  runtimeSupport,
  featureCompat = {},
) => {
  const runtimeNames = Object.keys(runtimeSupport)
  return runtimeNames.every((runtimeName) => {
    const runtimeVersion = runtimeSupport[runtimeName]
    const runtimeVersionCompatible = featureCompat[runtimeName] || "Infinity"
    const highestVersion = findHighestVersion(
      runtimeVersion,
      runtimeVersionCompatible,
    )
    return highestVersion === runtimeVersion
  })
}
