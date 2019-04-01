import { findHighestVersion, versionCompare } from "../../semantic-versioning/index.js"
import { computeIncompatibleNameArray } from "./computeIncompatibleNameArray.js"

export const computePlatformGroupArray = ({ compatibilityDescription, platformName }) => {
  const featureNameArray = Object.keys(compatibilityDescription)
  const featureNameArrayWithCompatibility = featureNameArray.filter(
    (featureName) => platformName in compatibilityDescription[featureName],
  )

  const versionArray = featureNameArrayWithCompatibility
    // why do I convert them to string, well ok let's keep it like that
    .map((featureName) => String(compatibilityDescription[featureName][platformName]))
    .concat("0.0.0") // at least version 0
    // filter is to have unique version I guess
    .filter((version, index, array) => array.indexOf(version) === index)
    .sort(versionCompare)

  const platformGroupArray = []

  versionArray.forEach((version) => {
    const incompatibleNameArray = computeIncompatibleNameArray({
      compatibilityDescription,
      platformName,
      platformVersion: version,
    }).sort()

    const platformGroupWithSameIncompatibleFeatures = platformGroupArray.find(
      (platformGroup) =>
        platformGroup.incompatibleNameArray.join("") === incompatibleNameArray.join(""),
    )

    if (platformGroupWithSameIncompatibleFeatures) {
      platformGroupWithSameIncompatibleFeatures.compatibility[platformName] = findHighestVersion(
        platformGroupWithSameIncompatibleFeatures.compatibility[platformName],
        version,
      )
    } else {
      platformGroupArray.push({
        incompatibleNameArray: incompatibleNameArray.slice(),
        compatibility: {
          [platformName]: version,
        },
      })
    }
  })

  return platformGroupArray
}
