import { objectMapValue } from "../objectHelper.js"

export const groupDescriptionToCompileDescription = (
  groupDescription,
  babelPluginDescription = {},
) => {
  return objectMapValue(groupDescription, ({ babelPluginNameArray }) => {
    const specificBabelPluginDescription = {}
    babelPluginNameArray.forEach((pluginName) => {
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
