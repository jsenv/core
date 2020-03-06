import { findHighestVersion } from "../semantic-versioning/index.js"
import { jsenvPluginCompatMap as jsenvPluginCompatMapFallback } from "../../jsenvPluginCompatMap.js"

export const computeJsenvPluginMapForRuntime = ({
  jsenvPluginMap,
  jsenvPluginCompatMap = jsenvPluginCompatMapFallback,
  runtimeName,
  runtimeVersion,
}) => {
  if (typeof jsenvPluginMap !== "object") {
    throw new TypeError(`jsenvPluginMap must be a object, got ${jsenvPluginMap}`)
  }
  if (typeof jsenvPluginCompatMap !== "object") {
    throw new TypeError(`jsenvPluginCompatMap must be a string, got ${jsenvPluginCompatMap}`)
  }
  if (typeof runtimeName !== "string") {
    throw new TypeError(`runtimeName must be a string, got ${runtimeName}`)
  }
  if (typeof runtimeVersion !== "string") {
    throw new TypeError(`runtimeVersion must be a string, got ${runtimeVersion}`)
  }

  const jsenvPluginMapForRuntime = {}
  Object.keys(jsenvPluginMap).forEach((key) => {
    const compatible = runtimeIsCompatibleWithFeature({
      runtimeName,
      runtimeVersion,
      featureCompat: key in jsenvPluginCompatMap ? jsenvPluginCompatMap[key] : {},
    })
    if (!compatible) {
      jsenvPluginMapForRuntime[key] = jsenvPluginMap[key]
    }
  })
  return jsenvPluginMapForRuntime
}

const runtimeIsCompatibleWithFeature = ({ runtimeName, runtimeVersion, featureCompat }) => {
  const runtimeCompatibleVersion = computeRuntimeCompatibleVersion({
    featureCompat,
    runtimeName,
  })
  const highestVersion = findHighestVersion(runtimeVersion, runtimeCompatibleVersion)
  return highestVersion === runtimeVersion
}

const computeRuntimeCompatibleVersion = ({ featureCompat, runtimeName }) => {
  return runtimeName in featureCompat ? featureCompat[runtimeName] : "Infinity"
}
