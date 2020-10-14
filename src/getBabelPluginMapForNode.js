import { computeBabelPluginMapForRuntime } from "./internal/generateGroupMap/computeBabelPluginMapForRuntime.js"
import { jsenvBabelPluginMap } from "./jsenvBabelPluginMap.js"

export const getBabelPluginMapForNode = (
  babelPluginMap = jsenvBabelPluginMap,
  nodeMinimumVersion = decideNodeMinimumVersion(),
) => {
  const babelPluginMapForNode = computeBabelPluginMapForRuntime({
    babelPluginMap,
    runtimeName: "node",
    runtimeVersion: nodeMinimumVersion,
  })
  return babelPluginMapForNode
}

const decideNodeMinimumVersion = () => {
  return process.version.slice(1)
}
