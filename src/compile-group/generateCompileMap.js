import { envDescriptionToCompileMap } from "./envDescriptionToCompileMap/index.js"

export const generateCompileMap = ({
  compileGroupCount,
  pluginMap = {},
  pluginCompatMap,
  platformUsageMap,
}) => {
  if (!pluginMap) throw new Error(`pluginMap is required`)

  const compileMap = envDescriptionToCompileMap({
    compileGroupCount,
    pluginNames: Object.keys(pluginMap),
    pluginCompatMap,
    platformUsageMap,
  })

  return compileMap
}
