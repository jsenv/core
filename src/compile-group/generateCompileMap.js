import { envDescriptionToCompileMap } from "./envDescriptionToCompileMap/index.js"

export const generateCompileMap = ({
  compileGroupCount,
  babelPluginDescription = {},
  platformScoring,
  pluginCompatMap,
}) => {
  if (!babelPluginDescription) throw new Error(`babelPluginDescription is required`)

  const compileMap = envDescriptionToCompileMap({
    compileGroupCount,
    babelPluginNameArray: Object.keys(babelPluginDescription),
    platformScoring,
    pluginCompatMap,
  })

  return compileMap
}
