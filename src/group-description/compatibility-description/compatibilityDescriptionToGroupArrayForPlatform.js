import { versionHighest, versionCompare } from "../../semantic-versioning/index.js"
import { computeBabelPluginNameArrayForPlatform } from "./computeBabelPluginNameArrayForPlatform.js"

export const compatibilityDescriptionToGroupArrayForPlatform = ({
  compatibilityDescription,
  platformName,
}) => {
  const babelPluginNameArray = Object.keys(compatibilityDescription)
  const babelPluginNameArrayWithCompatibility = babelPluginNameArray.filter(
    (babelPluginName) => platformName in compatibilityDescription[babelPluginName],
  )

  const platformVersions = babelPluginNameArrayWithCompatibility
    .map((babelPluginName) => String(compatibilityDescription[babelPluginName][platformName]))
    .concat("0.0.0") // at least version 0
    // filter is to have unique version I guess
    .filter((platformVersion, index, array) => array.indexOf(platformVersion) === index)
    .sort(versionCompare)

  const groupArray = []

  platformVersions.forEach((platformVersion) => {
    const babelPluginDescription = {}
    Object.keys(compatibilityDescription).forEach((babelPluginName) => {
      babelPluginDescription[babelPluginName] = babelPluginName
    })

    const babelPluginNameArrayForPlatform = computeBabelPluginNameArrayForPlatform({
      babelPluginDescription,
      platformName,
      platformVersion,
      compatibilityDescription,
    }).sort()

    const groupWithPlatformBabelPlugin = groupArray.find((platformGroup) => {
      return (
        platformGroup.babelPluginNameArray.join("") === babelPluginNameArrayForPlatform.join("")
      )
    })

    if (groupWithPlatformBabelPlugin) {
      groupWithPlatformBabelPlugin.compatibility[platformName] = versionHighest(
        groupWithPlatformBabelPlugin.compatibility[platformName],
        platformVersion,
      )
    } else {
      groupArray.push({
        babelPluginNameArray: babelPluginNameArrayForPlatform.slice(),
        compatibility: {
          [platformName]: platformVersion,
        },
      })
    }
  })

  return groupArray
}
