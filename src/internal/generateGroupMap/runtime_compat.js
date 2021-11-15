import { createOneRuntimeCompat } from "./one_runtime_compat.js"

export const createRuntimeCompat = ({
  runtimeSupport,
  pluginMap,
  pluginCompatMap,
}) => {
  const minRuntimeVersions = {}
  const pluginRequiredNameArray = []
  const runtimeNames = Object.keys(runtimeSupport)
  if (runtimeNames.length === 0) {
    // when runtimes are unknown, everything is required
    Object.keys(pluginMap).forEach((pluginName) => {
      pluginRequiredNameArray.push(pluginName)
    })
  } else {
    runtimeNames.forEach((runtimeName) => {
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
  }

  return {
    pluginRequiredNameArray,
    minRuntimeVersions,
  }
}
