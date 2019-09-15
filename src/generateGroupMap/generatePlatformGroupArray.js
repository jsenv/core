import { findHighestVersion, versionCompare } from "../semantic-versioning/index.js"
import { computeIncompatibleNameArray } from "./computeIncompatibleNameArray.js"

export const generatePlatformGroupArray = ({ featureCompatMap, platformName }) => {
  const featureNameArray = Object.keys(featureCompatMap)
  const featureNameArrayWithCompat = featureNameArray.filter(
    (featureName) => platformName in featureCompatMap[featureName],
  )

  const versionArray = featureNameArrayWithCompat
    // why do I convert them to string, well ok let's keep it like that
    .map((featureName) => String(featureCompatMap[featureName][platformName]))
    .concat("0.0.0") // at least version 0
    // filter is to have unique version I guess
    .filter((version, index, array) => array.indexOf(version) === index)
    .sort(versionCompare)

  const platformGroupArray = []

  versionArray.forEach((version) => {
    const incompatibleNameArray = computeIncompatibleNameArray({
      featureCompatMap,
      platformName,
      platformVersion: version,
    }).sort()

    const groupWithSameIncompatibleFeatures = platformGroupArray.find(
      (platformGroup) =>
        platformGroup.incompatibleNameArray.join("") === incompatibleNameArray.join(""),
    )

    if (groupWithSameIncompatibleFeatures) {
      groupWithSameIncompatibleFeatures.platformCompatMap[platformName] = findHighestVersion(
        groupWithSameIncompatibleFeatures.platformCompatMap[platformName],
        version,
      )
    } else {
      platformGroupArray.push({
        incompatibleNameArray: incompatibleNameArray.slice(),
        platformCompatMap: {
          [platformName]: version,
        },
      })
    }
  })

  return platformGroupArray
}
