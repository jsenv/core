import {
  versionHighest,
  versionCompare,
  pluginMapToPluginsForPlatform,
} from "@dmail/project-structure-compile-babel"

export const pluginCompatMapToPlatformGroups = (pluginCompatMap, platformName) => {
  const platformVersions = Object.keys(pluginCompatMap)
    .filter((pluginName) => platformName in pluginCompatMap[pluginName])
    .map((pluginName) => String(pluginCompatMap[pluginName][platformName]))
    .concat("0.0.0") // at least version 0
    .filter((platformVersion, index, array) => array.indexOf(platformVersion) === index)
    .sort(versionCompare)

  const platformGroups = []

  platformVersions.forEach((platformVersion) => {
    const pluginMap = {}
    Object.keys(pluginCompatMap).forEach((pluginName) => {
      pluginMap[pluginName] = pluginName
    })

    const platformPluginNames = pluginMapToPluginsForPlatform(
      pluginMap,
      platformName,
      platformVersion,
      pluginCompatMap,
    ).sort()

    const existingGroup = platformGroups.find((platformGroup) => {
      return platformGroup.pluginNames.join("") === platformPluginNames.join("")
    })

    if (existingGroup) {
      existingGroup.platformCompatMap[platformName] = versionHighest(
        existingGroup.platformCompatMap[platformName],
        platformVersion,
      )
    } else {
      platformGroups.push({
        pluginNames: platformPluginNames,
        platformCompatMap: {
          [platformName]: platformVersion,
        },
      })
    }
  })

  return platformGroups
}
