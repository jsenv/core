import { versionHighest } from "@dmail/project-structure-compile-babel"
import {
  composeMapToComposeStrict,
  objectComposeValue,
  objectMapValue,
} from "../../objectHelper.js"

const composePluginNames = (pluginList, secondPluginList) => {
  return [
    ...pluginList,
    ...secondPluginList.filter((plugin) => pluginList.indexOf(plugin) === -1),
  ].sort()
}

const normalizeCompatMapVersion = (compatMap) => {
  return objectMapValue(compatMap, (value) => String(value))
}

const composeCompatMap = (compatMap, secondCompatMap) => {
  compatMap = normalizeCompatMapVersion(compatMap)
  secondCompatMap = normalizeCompatMapVersion(secondCompatMap)

  return objectComposeValue(compatMap, secondCompatMap, (version, secondVersion) => {
    return versionHighest(version, secondVersion)
  })
}

export const composeGroups = composeMapToComposeStrict(
  {
    pluginNames: composePluginNames,
    compatMap: composeCompatMap,
  },
  () => ({
    pluginNames: [],
    compatMap: {},
  }),
)
