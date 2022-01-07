export const shakeBabelPluginMap = ({
  babelPluginMap,
  missingFeatureNames,
}) => {
  const babelPluginMapForGroup = {}
  missingFeatureNames.forEach((featureName) => {
    const babelPlugin = babelPluginMap[featureName]
    if (babelPlugin) {
      babelPluginMapForGroup[featureName] = babelPlugin
    }
  })
  Object.keys(babelPluginMap).forEach((key) => {
    if (key.startsWith("syntax-")) {
      babelPluginMapForGroup[key] = babelPluginMap[key]
    }
    if (key === "transform-replace-expressions") {
      babelPluginMapForGroup[key] = babelPluginMap[key]
    }
  })
  return babelPluginMapForGroup
}
