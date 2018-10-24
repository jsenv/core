export const createPluginNamesToScore = () => {
  const getPluginTranpilationComplexity = () => 1

  const pluginNamesToScore = (pluginNames) =>
    pluginNames.reduce(
      (previous, pluginName) => previous + getPluginTranpilationComplexity(pluginName),
      0,
    )

  return pluginNamesToScore
}
