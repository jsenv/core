import { findHighestVersion } from "../semantic-versioning/index.js"
import { jsenvBabelPluginCompatMap } from "./jsenvBabelPluginCompatMap.js"
import { jsenvPluginCompatMap as jsenvPluginCompatMapFallback } from "./jsenvPluginCompatMap.js"

export const getRuntimeCompileInfo = ({
  runtimeName,
  runtimeVersion,

  babelPluginMap,
  babelPluginCompatMap = jsenvBabelPluginCompatMap,

  jsenvPluginMap,
  jsenvPluginCompatMap = jsenvPluginCompatMapFallback,
}) => {
  let firstCompatibleRuntimeVersion

  const babelPluginRequiredNameArray = []
  Object.keys(babelPluginMap).forEach((babelPluginName) => {
    const { compatible, runtimeVersionCompatible } = getFeatureCompatInfo({
      runtimeName,
      runtimeVersion,
      runtimeCompatMap: babelPluginCompatMap[babelPluginName] || {},
    })
    if (compatible) {
      firstCompatibleRuntimeVersion =
        firstCompatibleRuntimeVersion || runtimeVersionCompatible
    } else {
      babelPluginRequiredNameArray.push(babelPluginName)
    }
  })

  const jsenvPluginRequiredNameArray = []
  Object.keys(jsenvPluginMap).forEach((jsenvPluginName) => {
    const { compatible, runtimeVersionCompatible } = getFeatureCompatInfo({
      runtimeName,
      runtimeVersion,
      runtimeCompatMap: jsenvPluginCompatMap[jsenvPluginName] || {},
    })
    if (compatible) {
      firstCompatibleRuntimeVersion =
        firstCompatibleRuntimeVersion || runtimeVersionCompatible
    } else {
      jsenvPluginRequiredNameArray.push(jsenvPluginName)
    }
  })

  return {
    babelPluginRequiredNameArray,
    jsenvPluginRequiredNameArray,
    runtimeVersion: firstCompatibleRuntimeVersion || runtimeVersion,
  }
}

const getFeatureCompatInfo = ({
  runtimeName,
  runtimeVersion,
  runtimeCompatMap,
}) => {
  const runtimeVersionCompatible = runtimeCompatMap[runtimeName]

  if (!runtimeVersionCompatible) {
    return {
      compatible: false,
      runtimeVersionCompatible: "Infinity",
    }
  }

  const highestVersion = findHighestVersion(
    runtimeVersion,
    runtimeVersionCompatible,
  )
  return {
    compatible: highestVersion === runtimeVersionCompatible,
    runtimeVersionCompatible,
  }
}
