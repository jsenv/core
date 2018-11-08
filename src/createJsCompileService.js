import { jsCompile } from "./jsCompile/index.js"
import { compileToCompileFile } from "./compileToCompileFile/index.js"
import { jsCompileFileToService } from "./jsCompileFileToService/index.js"
import { fileWriteFromString } from "@dmail/project-structure-compile-babel"
import { objectToPromiseAll } from "./promiseHelper.js"
import {
  compilePlatformAndSystem,
  getBrowserSystemLocalURL,
  getBrowserPlatformLocalURL,
  getCompileMapLocalURL,
} from "./compilePlatformAndSystem.js"
import { objectMapValue } from "./objectHelper.js"
import { envDescriptionToCompileMap } from "./envDescriptionToCompileMap/index.js"

const compileMapToCompileParamMap = (compileMap, pluginMap) => {
  return objectMapValue(compileMap, ({ pluginNames }) => {
    return {
      plugins: pluginNames.map((pluginName) => pluginMap[pluginName]),
    }
  })
}

export const createJsCompileService = async ({
  localRoot,
  compileInto,
  pluginMap,
  platformUsageMap,
  localCacheDisabled,
  localCacheTrackHit,
  cacheStrategy,
  assetCacheStrategy,
  listFilesToCover = () => [],
}) => {
  const compileMap = envDescriptionToCompileMap({
    pluginNames: Object.keys(pluginMap),
    platformUsageMap,
  })

  const { filesToCover } = await objectToPromiseAll({
    // we should not have to compile thoose static files
    // we would just have to move them to compileInto/
    compilePlatformAndSystem: compilePlatformAndSystem({
      browserSystemLocalURL: getBrowserSystemLocalURL({ localRoot, compileInto }),
      browserPlatformLocalURL: getBrowserPlatformLocalURL({ localRoot, compileInto }),
    }),
    writeCompileMap: fileWriteFromString(
      getCompileMapLocalURL({ localRoot, compileInto }),
      JSON.stringify(compileMap, null, "  "),
    ),
    filesToCover: listFilesToCover(),
  })

  const instrumentPredicate = (file) => filesToCover.indexOf(file) > -1

  const jsCompileFile = compileToCompileFile(jsCompile, { localRoot, compileInto })

  const compileParamMap = compileMapToCompileParamMap(compileMap, pluginMap)
  const jsCompileService = jsCompileFileToService(jsCompileFile, {
    localRoot,
    compileInto,
    compileParamMap,
    localCacheDisabled,
    localCacheTrackHit,
    cacheStrategy,
    assetCacheStrategy,
    instrumentPredicate,
  })

  return jsCompileService
}
