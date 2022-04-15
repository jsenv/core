import { findHighestVersion } from "@jsenv/utils/semantic_versioning/highest_version.js"
import { featureCompats } from "./features_compats.js"

export const RUNTIME_COMPAT = {
  featureCompats,

  add: (originalRuntimeCompat, feature) => {
    const featureCompat = getFeatureCompat(feature)
    const runtimeCompat = {
      ...originalRuntimeCompat,
    }
    Object.keys(featureCompat).forEach((runtimeName) => {
      const firstVersion = originalRuntimeCompat[runtimeName]
      const secondVersion = featureCompat[runtimeName]
      runtimeCompat[runtimeName] = firstVersion
        ? findHighestVersion(firstVersion, secondVersion)
        : secondVersion
    })
    return runtimeCompat
  },

  isSupported: (runtimeCompat, feature) => {
    const featureCompat = getFeatureCompat(feature)
    const runtimeNames = Object.keys(runtimeCompat)
    const runtimeWithoutCompat = runtimeNames.find((runtimeName) => {
      const runtimeVersion = runtimeCompat[runtimeName]
      const runtimeVersionCompatible = featureCompat[runtimeName] || "Infinity"
      const highestVersion = findHighestVersion(
        runtimeVersion,
        runtimeVersionCompatible,
      )
      return highestVersion !== runtimeVersion
    })
    return !runtimeWithoutCompat
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
