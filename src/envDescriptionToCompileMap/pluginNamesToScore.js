const getPluginTranpilationComplexity = () => 1

export const pluginNamesToScore = (pluginNames) =>
  pluginNames.reduce(
    (previous, pluginName) => previous + getPluginTranpilationComplexity(pluginName),
    0,
  )
