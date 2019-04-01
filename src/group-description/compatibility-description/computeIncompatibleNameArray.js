import { findHighestVersion } from "../../semantic-versioning/index.js"

export const computeIncompatibleNameArray = ({
  compatibilityDescription,
  platformName,
  platformVersion,
}) => {
  const incompatibleNameArray = []

  Object.keys(compatibilityDescription).forEach((featureName) => {
    const compatible = platformIsCompatibleWithFeature({
      platformName,
      platformVersion,
      featureCompatibility:
        featureName in compatibilityDescription ? compatibilityDescription[featureName] : {},
    })
    if (!compatible) {
      incompatibleNameArray.push(featureName)
    }
  })

  return incompatibleNameArray
}

const platformIsCompatibleWithFeature = ({
  platformName,
  platformVersion,
  featureCompatibility,
}) => {
  const platformCompatibleVersion = featureCompatibilityToPlatformCompatibleVersion({
    featureCompatibility,
    platformName,
  })
  const highestVersion = findHighestVersion(platformVersion, platformCompatibleVersion)
  return highestVersion === platformVersion
}

const featureCompatibilityToPlatformCompatibleVersion = ({
  featureCompatibility,
  platformName,
}) => {
  return platformName in featureCompatibility ? featureCompatibility[platformName] : "Infinity"
}
