import { objectMapValue } from "../objectHelper.js"

export const compileMapToCompileDescription = (compileMap, babelPluginDescription = {}) => {
  return objectMapValue(compileMap, ({ pluginNames }) => {
    const specificBabelPluginDescription = {}
    pluginNames.forEach((pluginName) => {
      if (pluginName in babelPluginDescription === false) {
        throw new Error(`missing ${pluginName} plugin in babelPluginDescription`)
      }
      specificBabelPluginDescription[pluginName] = babelPluginDescription[pluginName]
    })
    return {
      babelPluginDescription: specificBabelPluginDescription,
    }
  })
}
