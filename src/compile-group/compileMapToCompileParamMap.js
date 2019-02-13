import { objectMapValue } from "../objectHelper.js"

export const compileMapToCompileParamMap = (compileMap, babelPluginDescription = {}) => {
  return objectMapValue(compileMap, ({ pluginNames }) => {
    const pluginMapSubset = {}
    pluginNames.forEach((pluginName) => {
      if (pluginName in babelPluginDescription === false) {
        throw new Error(`missing ${pluginName} plugin in babelPluginDescription`)
      }
      pluginMapSubset[pluginName] = babelPluginDescription[pluginName]
    })
    return {
      babelPluginDescription: pluginMapSubset,
    }
  })
}
