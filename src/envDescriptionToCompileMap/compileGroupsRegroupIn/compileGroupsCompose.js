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
  return objectMapValue(compatMap, (version) => String(version))
}

const composeCompatMap = (compatMap, secondCompatMap) => {
  return objectComposeValue(
    normalizeCompatMapVersion(compatMap),
    normalizeCompatMapVersion(secondCompatMap),
    (version, secondVersion) => {
      return versionHighest(version, secondVersion)
    },
  )
}

export const compileGroupsCompose = composeMapToComposeStrict(
  {
    pluginNames: composePluginNames,
    compatMap: composeCompatMap,
  },
  () => ({
    pluginNames: [],
    compatMap: {},
  }),
)
