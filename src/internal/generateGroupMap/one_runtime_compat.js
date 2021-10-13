import { findHighestVersion } from "../semantic-versioning/index.js"

export const createOneRuntimeCompat = ({
  runtimeName,
  runtimeVersion,

  pluginMap,
  pluginCompatMap,
}) => {
  const pluginRequiredNameArray = []
  // will be the first runtime version compatible with all features not listed in
  // pluginRequiredNameArray
  let minRuntimeVersion

  Object.keys(pluginMap).forEach((pluginName) => {
    const pluginCompat = pluginCompatMap[pluginName] || {}
    const runtimeVersionCompatible = pluginCompat[runtimeName] || "Infinity"

    const highestVersion = findHighestVersion(
      runtimeVersion,
      runtimeVersionCompatible,
    )
    const compatible = highestVersion === runtimeVersion
    if (!compatible) {
      pluginRequiredNameArray.push(pluginName)
    }

    if (compatible && runtimeVersionCompatible !== "Infinity") {
      // there is a version from which runtime becomes compatible with this feature
      minRuntimeVersion = findHighestVersion(
        minRuntimeVersion || "0.0.0",
        runtimeVersionCompatible,
      )
    }
  })

  return {
    pluginRequiredNameArray,
    minRuntimeVersion: minRuntimeVersion || runtimeVersion,
  }
}
