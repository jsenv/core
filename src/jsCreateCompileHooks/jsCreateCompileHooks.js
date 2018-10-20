import { getCompatGroupMap, DEFAULT_ID } from "./getCompatGroupMap.js"
import { objectMapValue } from "../objectHelper.js"

const compatGroupMapToClientCompatGroupMap = (compatGroupMap) => {
  return objectMapValue(compatGroupMap, ({ compatMap }) => compatMap)
}

export const jsCreateCompileHooks = ({
  configLocation,

  stats,
  compatMap,
  size,
  platformNames,
  pluginMap,
}) => {
  return getCompatGroupMap({
    configLocation,
    stats,
    compatMap,
    size,
    platformNames,
    pluginNames: Object.keys(pluginMap),
  }).then((compatGroupMap) => {
    const pluginNameToPlugin = (pluginName) => pluginMap[pluginName]

    return {
      VARS: {
        COMPAT_MAP: compatGroupMapToClientCompatGroupMap(compatGroupMap),
        COMPAT_MAP_DEFAULT_ID: DEFAULT_ID,
      },
      compileIdToCompileParams: (compileId) => {
        const pluginNames = compatGroupMap[compileId].pluginNames

        return {
          // this is how babel expect us to pass option to plugin
          plugins: pluginNames.map((pluginName) => pluginNameToPlugin(pluginName)),
        }
      },
    }
  })
}
