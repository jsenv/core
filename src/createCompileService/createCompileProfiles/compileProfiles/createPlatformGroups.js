import {
  versionHighest,
  versionCompare,
  getPluginNamesForPlatform,
} from "@dmail/project-structure-compile-babel"

export const createPlatformGroups = (compatMap, platformName) => {
  const platformVersions = Object.keys(compatMap)
    .filter((pluginName) => platformName in compatMap[pluginName])
    .map((pluginName) => String(compatMap[pluginName][platformName]))
    .concat("0.0.0") // at least version 0
    .filter((platformVersion, index, array) => array.indexOf(platformVersion) === index)
    .sort(versionCompare)

  const platformGroups = []

  platformVersions.forEach((platformVersion) => {
    const pluginNames = getPluginNamesForPlatform(compatMap, platformName, platformVersion).sort()
    const existingGroup = platformGroups.find((platformGroup) => {
      return platformGroup.pluginNames.join("") === pluginNames.join("")
    })
    if (existingGroup) {
      existingGroup.compatMap[platformName] = versionHighest(
        existingGroup.compatMap[platformName],
        platformVersion,
      )
    } else {
      platformGroups.push({
        pluginNames,
        compatMap: {
          [platformName]: platformVersion,
        },
      })
    }
  })

  return platformGroups
}
