import {
  findHighestVersion,
  findLowestVersion,
} from "../semantic-versioning/index.js"
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
  let minRuntimeVersion = runtimeVersion

  const babelPluginRequiredNameArray = []
  Object.keys(babelPluginMap).forEach((babelPluginName) => {
    const babelPluginCompat = babelPluginCompatMap[babelPluginName] || {}
    const runtimeVersionCompatible =
      babelPluginCompat[runtimeName] || "Infinity"

    const highestVersion = findHighestVersion(
      runtimeVersion,
      runtimeVersionCompatible,
    )
    if (highestVersion !== runtimeVersion) {
      babelPluginRequiredNameArray.push(babelPluginName)
    }
    minRuntimeVersion = findLowestVersion(
      minRuntimeVersion,
      runtimeVersionCompatible,
    )
  })

  const jsenvPluginRequiredNameArray = []
  Object.keys(jsenvPluginMap).forEach((jsenvPluginName) => {
    const jsenvPluginCompat = jsenvPluginCompatMap[jsenvPluginName] || {}
    const runtimeVersionCompatible =
      jsenvPluginCompat[runtimeName] || "Infinity"

    const highestVersion = findHighestVersion(
      runtimeVersion,
      runtimeVersionCompatible,
    )
    if (highestVersion !== runtimeVersion) {
      jsenvPluginRequiredNameArray.push(jsenvPluginName)
    }
    minRuntimeVersion = findLowestVersion(
      minRuntimeVersion,
      runtimeVersionCompatible,
    )
  })

  return {
    babelPluginRequiredNameArray,
    jsenvPluginRequiredNameArray,
    minRuntimeVersion,
  }
}
