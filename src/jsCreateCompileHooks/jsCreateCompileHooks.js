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
    const compileParamMap = objectMapValue(compatGroupMap, ({ pluginNames }) => {
      return {
        plugins: pluginNames.map((pluginName) => pluginMap[pluginName]),
      }
    })

    return {
      VARS: {
        COMPAT_MAP: compatGroupMapToClientCompatGroupMap(compatGroupMap),
        COMPAT_MAP_DEFAULT_ID: DEFAULT_ID,
      },
      compileParamMap,
    }
  })
}
