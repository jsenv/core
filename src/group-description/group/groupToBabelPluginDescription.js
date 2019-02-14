export const groupToBabelPluginDescription = (group, babelPluginDescription) => {
  const { babelPluginNameArray } = group

  const groupBabelPluginDescription = {}
  babelPluginNameArray.forEach((babelPluginName) => {
    if (babelPluginName in babelPluginDescription === false) {
      throw new Error(`missing ${babelPluginName} plugin in babelPluginDescription`)
    }
    groupBabelPluginDescription[babelPluginName] = babelPluginDescription[babelPluginName]
  })
  return groupBabelPluginDescription
}
