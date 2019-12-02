import { computeBabelPluginMapForPlatform } from "internal/generateGroupMap/computeBabelPluginMapForPlatform.js"
import { generateCommonJsBundle } from "src/generateCommonJsBundle.js"
import { jsenvBabelPluginMap } from "src/jsenvBabelPluginMap.js"

export const generateCommonJsBundleForNode = ({
  babelPluginMap = jsenvBabelPluginMap,
  bundleDirectoryRelativeUrl,
  nodeMinimumVersion = decideNodeMinimumVersion(),
  ...rest
}) => {
  const babelPluginMapForNode = computeBabelPluginMapForPlatform({
    babelPluginMap,
    platformName: "node",
    platformVersion: nodeMinimumVersion,
  })

  return generateCommonJsBundle({
    bundleDirectoryRelativeUrl,
    compileGroupCount: 1,
    babelPluginMap: babelPluginMapForNode,
    ...rest,
  })
}

const decideNodeMinimumVersion = () => {
  return process.version.slice(1)
}
