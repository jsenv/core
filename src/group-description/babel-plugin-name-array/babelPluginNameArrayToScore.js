export const babelPluginNameArrayToScore = (babelPluginNameArray) =>
  babelPluginNameArray.reduce(
    (previous, pluginName) => previous + getPluginTranpilationComplexity(pluginName),
    0,
  )

const getPluginTranpilationComplexity = () => 1
