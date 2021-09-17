import { findHighestVersion } from "../semantic-versioning/index.js"
import { jsenvBabelPluginCompatMap } from "./jsenvBabelPluginCompatMap.js"

export const computeBabelPluginMapForRuntime = ({
  babelPluginMap,
  babelPluginCompatMap = jsenvBabelPluginCompatMap,
  runtimeName,
  runtimeVersion,
}) => {
  if (typeof babelPluginMap !== "object") {
    throw new TypeError(
      `babelPluginMap must be an object, got ${babelPluginMap}`,
    )
  }
  if (typeof babelPluginCompatMap !== "object") {
    throw new TypeError(
      `babelPluginCompatMap must be an object, got ${babelPluginCompatMap}`,
    )
  }
  if (typeof runtimeName !== "string") {
    throw new TypeError(`runtimeName must be a string, got ${runtimeName}`)
  }
  if (typeof runtimeVersion !== "string") {
    throw new TypeError(
      `runtimeVersion must be a string, got ${runtimeVersion}`,
    )
  }

  const babelPluginMapForRuntime = {}
  Object.keys(babelPluginMap).forEach((key) => {
    const compatible = runtimeIsCompatibleWithFeature({
      runtimeName,
      runtimeVersion,
      runtimeCompatMap:
        key in babelPluginCompatMap ? babelPluginCompatMap[key] : {},
    })
    if (!compatible) {
      babelPluginMapForRuntime[key] = babelPluginMap[key]
    }
  })
  return babelPluginMapForRuntime
}

const runtimeIsCompatibleWithFeature = ({
  runtimeName,
  runtimeVersion,
  runtimeCompatMap,
}) => {
  const runtimeCompatibleVersion = computeRuntimeCompatibleVersion({
    runtimeCompatMap,
    runtimeName,
  })
  const highestVersion = findHighestVersion(
    runtimeVersion,
    runtimeCompatibleVersion,
  )
  return highestVersion === runtimeVersion
}

const computeRuntimeCompatibleVersion = ({ runtimeCompatMap, runtimeName }) => {
  return runtimeName in runtimeCompatMap
    ? runtimeCompatMap[runtimeName]
    : "Infinity"
}
