export const shakeBabelPluginMap = ({ babelPluginMap, compileProfile }) => {
  const babelPluginMapShaked = {}
  Object.keys(babelPluginMap).forEach((babelPluginName) => {
    if (!compileProfile.featuresReport[babelPluginName]) {
      babelPluginMapShaked[babelPluginName] = babelPluginMap[babelPluginName]
    }
  })
  Object.keys(babelPluginMap).forEach((key) => {
    if (key.startsWith("syntax-")) {
      babelPluginMapShaked[key] = babelPluginMap[key]
    }
    if (key === "transform-replace-expressions") {
      babelPluginMapShaked[key] = babelPluginMap[key]
    }
  })
  return babelPluginMapShaked
}
