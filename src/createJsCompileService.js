import { fileWriteFromString } from "@dmail/project-structure-compile-babel"
import { envDescriptionToCompileMap } from "./envDescriptionToCompileMap/index.js"
import { namedPromiseAll } from "./promiseHelper.js"
import { objectMapValue } from "./objectHelper.js"
import { jsCompile } from "./jsCompile/index.js"
import { jsCompileToService } from "./jsCompileToService/index.js"

export const createJsCompileService = async ({
  cancellationToken,
  localRoot,
  compileInto,
  pluginMap,
  platformUsageMap,
  pluginCompatMap,
  localCacheDisabled,
  localCacheTrackHit,
  cacheStrategy,
  assetCacheStrategy,
  watch,
  watchPredicate,
  listFilesToCover = () => [],
}) => {
  if (!pluginMap) throw new Error(`pluginMap is required`)

  const compileMap = envDescriptionToCompileMap({
    pluginNames: Object.keys(pluginMap),
    platformUsageMap,
    pluginCompatMap,
  })

  const { filesToCover } = await namedPromiseAll({
    writeCompileMap: fileWriteFromString(
      `${localRoot}/${compileInto}/compileMap.json`,
      JSON.stringify(compileMap, null, "  "),
    ),
    filesToCover: listFilesToCover(),
  })

  const compileParamMap = compileMapToCompileParamMap(compileMap, pluginMap)

  const instrumentPredicate = (file) => filesToCover.indexOf(file) > -1

  const jsCompileService = jsCompileToService(jsCompile, {
    cancellationToken,
    localRoot,
    compileInto,
    compileParamMap,
    localCacheDisabled,
    localCacheTrackHit,
    cacheStrategy,
    assetCacheStrategy,
    instrumentPredicate,
    watch,
    watchPredicate,
  })

  return jsCompileService
}

const compileMapToCompileParamMap = (compileMap, pluginMap = {}) => {
  return objectMapValue(compileMap, ({ pluginNames }) => {
    const pluginMapSubset = {}
    pluginNames.forEach((pluginName) => {
      if (pluginName in pluginMap === false) {
        throw new Error(`missing ${pluginName} plugin in pluginMap`)
      }
      pluginMapSubset[pluginName] = pluginMap[pluginName]
    })
    return {
      pluginMap: pluginMapSubset,
    }
  })
}
