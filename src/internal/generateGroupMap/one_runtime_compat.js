import { findHighestVersion } from "../semantic-versioning/index.js"
import { jsenvBabelPluginCompatMap } from "./jsenvBabelPluginCompatMap.js"
import { jsenvPluginCompatMap as jsenvPluginCompatMapFallback } from "./jsenvPluginCompatMap.js"

export const createOneRuntimeCompat = ({
  runtimeName,
  runtimeVersion,

  babelPluginMap,
  babelPluginCompatMap = jsenvBabelPluginCompatMap,

  jsenvPluginMap,
  jsenvPluginCompatMap = jsenvPluginCompatMapFallback,
}) => {
  const babelPluginRequiredNameArray = []
  const jsenvPluginRequiredNameArray = []
  // will be the first runtime version compatible with all features not listed in
  // babelPluginRequiredNameArray or jsenvPluginRequiredNameArray
  let minRuntimeVersion

  Object.keys(babelPluginMap).forEach((babelPluginName) => {
    const babelPluginCompat = babelPluginCompatMap[babelPluginName] || {}
    const runtimeVersionCompatible =
      babelPluginCompat[runtimeName] || "Infinity"

    const highestVersion = findHighestVersion(
      runtimeVersion,
      runtimeVersionCompatible,
    )
    const compatible = highestVersion === runtimeVersion
    if (!compatible) {
      babelPluginRequiredNameArray.push(babelPluginName)
    }

    if (compatible && runtimeVersionCompatible !== "Infinity") {
      // there is a version from which runtime becomes compatible with this feature
      minRuntimeVersion = findHighestVersion(
        minRuntimeVersion || "0.0.0",
        runtimeVersionCompatible,
      )
    }
  })

  Object.keys(jsenvPluginMap).forEach((jsenvPluginName) => {
    const jsenvPluginCompat = jsenvPluginCompatMap[jsenvPluginName] || {}
    const runtimeVersionCompatible =
      jsenvPluginCompat[runtimeName] || "Infinity"

    const highestVersion = findHighestVersion(
      runtimeVersion,
      runtimeVersionCompatible,
    )
    if (highestVersion === runtimeVersion) {
      // compatible, in that case the min runtime version can be updated
      minRuntimeVersion = findHighestVersion(
        minRuntimeVersion || "0.0.0",
        runtimeVersionCompatible,
      )
    } else {
      // not compatible, no need to increase runtime version
      jsenvPluginRequiredNameArray.push(jsenvPluginName)
    }
  })

  return {
    babelPluginRequiredNameArray,
    jsenvPluginRequiredNameArray,
    minRuntimeVersion: minRuntimeVersion || runtimeVersion,
  }
}
