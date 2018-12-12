import {
  fileWriteFromString,
  pluginOptionMapToPluginMap,
} from "@dmail/project-structure-compile-babel"
import { objectToPromiseAll } from "./promiseHelper.js"
import { objectMapValue, objectFilter } from "./objectHelper.js"
import { jsCompile } from "./jsCompile/index.js"
import { jsCompileToService } from "./jsCompileToService/index.js"
import { envDescriptionToCompileMap } from "./envDescriptionToCompileMap/index.js"
import { getCompileMapLocalURL } from "./compileBrowserPlatform/index.js"

const compileMapToCompileParamMap = (compileMap, pluginMap) => {
  return objectMapValue(compileMap, ({ pluginNames }) => {
    return {
      pluginMap: objectFilter(pluginMap, (pluginName) => pluginNames.includes(pluginName)),
    }
  })
}

const pluginMapDefault = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},
})

export const createJsCompileService = async ({
  cancellationToken,
  localRoot,
  compileInto,
  pluginMap = pluginMapDefault,
  platformUsageMap,
  localCacheDisabled,
  localCacheTrackHit,
  cacheStrategy,
  assetCacheStrategy,
  watch,
  watchPredicate,
  listFilesToCover = () => [],
}) => {
  const compileMap = envDescriptionToCompileMap({
    pluginNames: Object.keys(pluginMap),
    platformUsageMap,
  })

  const { filesToCover } = await objectToPromiseAll({
    writeCompileMap: fileWriteFromString(
      getCompileMapLocalURL({ localRoot, compileInto }),
      JSON.stringify(compileMap, null, "  "),
    ),
    filesToCover: listFilesToCover(),
  })

  const instrumentPredicate = (file) => filesToCover.indexOf(file) > -1

  const compileParamMap = compileMapToCompileParamMap(compileMap, pluginMap)
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
