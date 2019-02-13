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
    const babelPluginDescription = {}
    Object.keys(pluginCompatMap).forEach((pluginName) => {
      babelPluginDescription[pluginName] = pluginName
    })

    const platformPluginNames = pluginMapToPluginsForPlatform(
      babelPluginDescription,
      platformName,
      platformVersion,
      pluginCompatMap,
    ).sort()

    const existingGroup = platformGroups.find((platformGroup) => {
      return platformGroup.babelPluginNameArray.join("") === platformPluginNames.join("")
    })

    if (existingGroup) {
      existingGroup.compatMap[platformName] = versionHighest(
        existingGroup.compatMap[platformName],
        platformVersion,
      )
    } else {
      platformGroups.push({
        babelPluginNameArray: platformPluginNames,
        compatMap: {
          [platformName]: platformVersion,
        },
      })
    }
  })

  return platformGroups
}
