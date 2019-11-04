import { computeBabelPluginMapForPlatform } from "./computeBabelPluginMapForPlatform.js"
import { generateCommonJsBundle } from "./generateCommonJsBundle.js"

const { jsenvBabelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

export const generateCommonJsBundleForNode = ({
  babelPluginMap = jsenvBabelPluginMap,
  bundleDirectoryRelativePath,
  nodeMinimumVersion = decideNodeMinimumVersion(),
  ...rest
}) => {
  const babelPluginMapForNode = computeBabelPluginMapForPlatform({
    babelPluginMap,
    platformName: "node",
    platformVersion: nodeMinimumVersion,
  })

  return generateCommonJsBundle({
    bundleDirectoryRelativePath,
    compileGroupCount: 1,
    babelPluginMap: babelPluginMapForNode,
    ...rest,
  })
}

const decideNodeMinimumVersion = () => {
  return process.version.slice(1)
}
