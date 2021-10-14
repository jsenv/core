import { createOneRuntimeCompat } from "./one_runtime_compat.js"

export const createRuntimeCompat = ({
  runtimeSupport,
  pluginMap,
  pluginCompatMap,
}) => {
  const minRuntimeVersions = {}
  const pluginRequiredNameArray = []
  Object.keys(runtimeSupport).forEach((runtimeName) => {
    const runtimeVersion = runtimeSupport[runtimeName]
    const oneRuntimeCompat = createOneRuntimeCompat({
      runtimeName,
      runtimeVersion,
      pluginMap,
      pluginCompatMap,
    })

    minRuntimeVersions[runtimeName] = oneRuntimeCompat.minRuntimeVersion
    oneRuntimeCompat.pluginRequiredNameArray.forEach((babelPluginName) => {
      if (!pluginRequiredNameArray.includes(babelPluginName)) {
        pluginRequiredNameArray.push(babelPluginName)
      }
    })
  })

  return {
    pluginRequiredNameArray,
    minRuntimeVersions,
  }
}
