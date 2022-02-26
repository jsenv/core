export const getRuntimeBabelPluginStructure = ({
  babelPluginStructure,
  availableFeatureNames,
  options,
}) => {
  const babelPluginStructureForRuntime = {}
  Object.keys(babelPluginStructure).forEach((babelPluginName) => {
    if (availableFeatureNames.includes(babelPluginName)) {
      return
    }
    babelPluginStructureForRuntime[babelPluginName] = composeOptions(
      babelPluginStructure[babelPluginName],
      options[babelPluginName],
    )
  })
  return babelPluginStructureForRuntime
}

const composeOptions = (babelPlugin, options) => {
  if (!options) {
    return [babelPlugin]
  }
  if (Array.isArray(babelPlugin)) {
    const [plugin, existingOptions] = babelPlugin
    if (existingOptions) {
      return [plugin, { ...existingOptions, ...options }]
    }
    return [plugin, options]
  }
  return [babelPlugin, options]
}
