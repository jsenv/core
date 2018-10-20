import { versionHighest } from "@dmail/project-structure-compile-babel"
import { composeMapToCompose, objectComposeValue } from "../../objectHelper.js"

const composePluginNames = (pluginList, secondPluginList) => {
  return [...pluginList, ...secondPluginList.filter((plugin) => pluginList.indexOf(plugin) === -1)]
}

const composeCompatMap = (previousCompatMap, compatMap) => {
  return objectComposeValue(previousCompatMap, compatMap, (previousVersion, version) => {
    return versionHighest(previousVersion, version)
  })
}

export const composeGroups = composeMapToCompose(
  {
    pluginNames: composePluginNames,
    compatMap: composeCompatMap,
  },
  () => ({
    pluginNames: [],
    compatMap: {},
  }),
)
