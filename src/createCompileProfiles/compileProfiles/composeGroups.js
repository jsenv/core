import { versionHighest } from "@dmail/project-structure-compile-babel"

const composePluginNames = (pluginList, secondPluginList) => {
  return [...pluginList, ...secondPluginList.filter((plugin) => pluginList.indexOf(plugin) === -1)]
}

const groupReducer = (previous, group) => {
  const pluginNames = composePluginNames(previous.pluginNames, group.pluginNames).sort()

  const previousCompatMap = previous.compatMap
  const groupCompatMap = group.compatMap
  const compatMap = { ...previousCompatMap }
  Object.keys(groupCompatMap).forEach((platformName) => {
    const platformVersion = groupCompatMap[platformName]
    compatMap[platformName] = String(
      platformName in compatMap
        ? versionHighest(compatMap[platformName], platformVersion)
        : platformVersion,
    )
  })

  return {
    pluginNames,
    compatMap,
  }
}

export const composeGroups = (...groups) => {
  return groups.reduce(groupReducer, {
    pluginNames: [],
    compatMap: {},
  })
}
