import { objectMapValue } from "../objectHelper.js"

export const compileMapToCompileParamMap = (compileMap, pluginMap = {}) => {
  return objectMapValue(compileMap, ({ pluginNames }) => {
    const pluginMapSubset = {}
    pluginNames.forEach((pluginName) => {
      if (pluginName in pluginMap === false) {
        throw new Error(`missing ${pluginName} plugin in pluginMap`)
      }
      pluginMapSubset[pluginName] = pluginMap[pluginName]
    })
    return {
      pluginMap: pluginMapSubset,
    }
  })
}
