import { envDescriptionToCompileMap } from "./envDescriptionToCompileMap/index.js"

export const generateCompileMap = ({
  compileGroupCount,
  pluginMap = {},
  platformUsageMap,
  pluginCompatMap,
}) => {
  if (!pluginMap) throw new Error(`pluginMap is required`)

  const compileMap = envDescriptionToCompileMap({
    compileGroupCount,
    pluginNames: Object.keys(pluginMap),
    platformUsageMap,
    pluginCompatMap,
  })

  return compileMap
}
