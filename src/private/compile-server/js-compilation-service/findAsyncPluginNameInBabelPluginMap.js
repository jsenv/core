export const findAsyncPluginNameInBabelPluginMap = (babelPluginMap) => {
  if ("transform-async-to-promises" in babelPluginMap) {
    return "transform-async-to-promises"
  }
  if ("transform-async-to-generator" in babelPluginMap) {
    return "transform-async-to-generator"
  }
  return ""
}
