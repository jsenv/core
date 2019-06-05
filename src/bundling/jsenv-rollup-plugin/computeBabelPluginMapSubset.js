export const computeBabelPluginMapSubset = ({ babelPluginMap, featureNameArray }) => {
  const babelPluginMapSubset = {}

  Object.keys(babelPluginMap).forEach((babelPluginName) => {
    if (featureNameArray.includes(babelPluginName)) {
      babelPluginMapSubset[babelPluginName] = babelPluginMap[babelPluginName]
    }
  })

  return babelPluginMapSubset
}
