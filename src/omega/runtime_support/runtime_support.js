import { findHighestVersion } from "@jsenv/utils/semantic_versioning/highest_version.js"
import { featureCompats } from "./features_compatibility.js"

export const RUNTIME_SUPPORT = {
  featureCompats,

  add: (originalRuntimeSupport, feature) => {
    const featureCompat = getFeatureCompat(feature)
    const runtimeSupport = {
      ...originalRuntimeSupport,
    }
    Object.keys(featureCompat).forEach((runtimeName) => {
      const firstVersion = originalRuntimeSupport[runtimeName]
      const secondVersion = featureCompat[runtimeName]
      runtimeSupport[runtimeName] = firstVersion
        ? findHighestVersion(firstVersion, secondVersion)
        : secondVersion
    })
    return runtimeSupport
  },

  isSupported: (runtimeSupport, feature) => {
    const featureCompat = getFeatureCompat(feature)
    const runtimeNames = Object.keys(runtimeSupport)
    return runtimeNames.every((runtimeName) => {
      const runtimeVersion = runtimeSupport[runtimeName]
      const runtimeVersionCompatible = featureCompat[runtimeName] || "Infinity"
      const highestVersion = findHighestVersion(
        runtimeVersion,
        runtimeVersionCompatible,
      )
      if (highestVersion !== runtimeVersion) {
        return false
      }
      return true
    })
  },
}

const getFeatureCompat = (feature) => {
  if (typeof feature === "string") {
    const compat = featureCompats[feature]
    if (!compat) {
      throw new Error(`"${feature}" feature is unknown`)
    }
    return compat
  }
  if (typeof feature !== "object") {
    throw new TypeError(`feature must be a string or an object, got ${feature}`)
  }
  return feature
}
