import { computeBabelPluginMapForRuntime } from "./internal/generateGroupMap/computeBabelPluginMapForRuntime.js"
import { generateCommonJsBundle } from "./generateCommonJsBundle.js"
import { jsenvBabelPluginMap } from "./jsenvBabelPluginMap.js"

export const generateCommonJsBundleForNode = ({
  babelPluginMap = jsenvBabelPluginMap,
  bundleDirectoryRelativeUrl,
  nodeMinimumVersion = decideNodeMinimumVersion(),
  cjsExtension,
  ...rest
}) => {
  const babelPluginMapForNode = computeBabelPluginMapForRuntime({
    babelPluginMap,
    runtimeName: "node",
    runtimeVersion: nodeMinimumVersion,
  })

  return generateCommonJsBundle({
    bundleDirectoryRelativeUrl,
    cjsExtension,
    compileGroupCount: 1,
    babelPluginMap: babelPluginMapForNode,
    ...rest,
  })
}

const decideNodeMinimumVersion = () => {
  return process.version.slice(1)
}
