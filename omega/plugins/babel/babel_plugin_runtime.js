export const getRuntimeBabelPluginStructure = ({
  babelPluginStructure,
  availableFeatureNames,
}) => {
  const babelPluginStructureForRuntime = {}
  Object.keys(babelPluginStructure).forEach((babelPluginName) => {
    if (availableFeatureNames.includes(babelPluginName)) {
      return
    }
    babelPluginStructureForRuntime[babelPluginName] =
      babelPluginStructure[babelPluginName]
  })
  return babelPluginStructureForRuntime
}
