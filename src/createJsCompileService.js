import { objectMapValue, objectFilter } from "./objectHelper.js"
import { jsCompile } from "./jsCompile/index.js"
import { jsCompileToService } from "./jsCompileToService/index.js"
import { getCompileMapLocalURL } from "./compileProject/index.js"

export const createJsCompileService = async ({
  cancellationToken,
  localRoot,
  compileInto,
  pluginMap,
  localCacheDisabled,
  localCacheTrackHit,
  cacheStrategy,
  assetCacheStrategy,
  watch,
  watchPredicate,
  listFilesToCover = () => [],
}) => {
  // eslint-disable-next-line import/no-dynamic-require
  const compileMap = require(getCompileMapLocalURL({ localRoot, compileInto }))
  const compileParamMap = compileMapToCompileParamMap(compileMap, pluginMap)

  const filesToCover = await listFilesToCover()

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

const compileMapToCompileParamMap = (compileMap, pluginMap) => {
  return objectMapValue(compileMap, ({ pluginNames }) => {
    return {
      pluginMap: objectFilter(pluginMap, (pluginName) => pluginNames.includes(pluginName)),
    }
  })
}
