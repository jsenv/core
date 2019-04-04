import { findHighestVersion } from "../../semantic-versioning/index.js"

export const computeIncompatibleNameArray = ({
  featureCompatMap,
  platformName,
  platformVersion,
}) => {
  const incompatibleNameArray = []

  Object.keys(featureCompatMap).forEach((featureName) => {
    const compatible = platformIsCompatibleWithFeature({
      platformName,
      platformVersion,
      featureCompat: featureName in featureCompatMap ? featureCompatMap[featureName] : {},
    })
    if (!compatible) {
      incompatibleNameArray.push(featureName)
    }
  })

  return incompatibleNameArray
}

const platformIsCompatibleWithFeature = ({ platformName, platformVersion, featureCompat }) => {
  const platformCompatibleVersion = computePlatformCompatibleVersion({
    featureCompat,
    platformName,
  })
  const highestVersion = findHighestVersion(platformVersion, platformCompatibleVersion)
  return highestVersion === platformVersion
}

const computePlatformCompatibleVersion = ({ featureCompat, platformName }) => {
  return platformName in featureCompat ? featureCompat[platformName] : "Infinity"
}
