import { findHighestVersion } from "@jsenv/utils/src/semantic_versioning/highest_version.js";

import { featuresCompatMap } from "./features_compatibility.js";

export const RUNTIME_COMPAT = {
  featuresCompatMap,

  add: (originalRuntimeCompat, feature) => {
    const featureCompat = getFeatureCompat(feature);
    const runtimeCompat = {
      ...originalRuntimeCompat,
    };
    Object.keys(originalRuntimeCompat).forEach((runtimeName) => {
      const secondVersion = featureCompat[runtimeName]; // the version supported by the feature
      if (secondVersion) {
        const firstVersion = originalRuntimeCompat[runtimeName];
        runtimeCompat[runtimeName] = findHighestVersion(
          firstVersion,
          secondVersion,
        );
      }
    });
    return runtimeCompat;
  },

  isSupported: (runtimeCompat, feature) => {
    const featureCompat = getFeatureCompat(feature);
    const runtimeNames = Object.keys(runtimeCompat);
    const runtimeWithoutCompat = runtimeNames.find((runtimeName) => {
      const runtimeVersion = runtimeCompat[runtimeName];
      const runtimeVersionCompatible = featureCompat[runtimeName] || "Infinity";
      const highestVersion = findHighestVersion(
        runtimeVersion,
        runtimeVersionCompatible,
      );
      return highestVersion !== runtimeVersion;
    });
    return !runtimeWithoutCompat;
  },
};

const getFeatureCompat = (feature) => {
  if (typeof feature === "string") {
    const compat = featuresCompatMap[feature];
    if (!compat) {
      throw new Error(`"${feature}" feature is unknown`);
    }
    return compat;
  }
  if (typeof feature !== "object") {
    throw new TypeError(
      `feature must be a string or an object, got ${feature}`,
    );
  }
  return feature;
};
