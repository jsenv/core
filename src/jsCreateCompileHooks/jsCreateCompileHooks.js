import { DEFAULT_ID } from "./getCompatGroupMap.js"
import { objectMapValue } from "../objectHelper.js"

const compatGroupMapToClientCompatGroupMap = (compatGroupMap) => {
  return objectMapValue(compatGroupMap, ({ compatMap }) => compatMap)
}

export const jsCreateCompileHooks = ({ compatGroupMap, pluginMap }) => {
  const compileParamMap = objectMapValue(compatGroupMap, ({ pluginNames }) => {
    return {
      plugins: pluginNames.map((pluginName) => pluginMap[pluginName]),
    }
  })

  return {
    compatMap: compatGroupMapToClientCompatGroupMap(compatGroupMap),
    compatMapDefaultId: DEFAULT_ID,
    compileParamMap,
  }
}
