import { envDescriptionToCompileMap } from "./envDescriptionToCompileMap/index.js"

export const generateCompileMap = ({
  compileGroupCount,
  babelPluginDescription = {},
  platformUsageMap,
  pluginCompatMap,
}) => {
  if (!babelPluginDescription) throw new Error(`babelPluginDescription is required`)

  const compileMap = envDescriptionToCompileMap({
    compileGroupCount,
    pluginNames: Object.keys(babelPluginDescription),
    platformUsageMap,
    pluginCompatMap,
  })

  return compileMap
}
