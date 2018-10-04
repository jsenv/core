export const createGetScoreForGroupTranspilationComplexity = () => {
  const getPluginTranpilationComplexity = () => 1

  const getGroupTranspilationComplexityScore = (group) =>
    group.pluginNames.reduce(
      (previous, pluginName) => previous + getPluginTranpilationComplexity(pluginName),
      0,
    )

  return getGroupTranspilationComplexityScore
}
