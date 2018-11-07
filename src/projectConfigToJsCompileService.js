import { jsCompile } from "./jsCompile/index.js"
import { jsCompileToCompileFile } from "./jsCompileToCompileFile/index.js"
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

const compileMapToCompileParamMap = (compileMap, pluginMap) => {
  return objectMapValue(compileMap, ({ pluginNames }) => {
    return {
      plugins: pluginNames.map((pluginName) => pluginMap[pluginName]),
    }
  })
}

export const projectConfigToJsCompileService = async ({
  localRoot,
  compileInto,
  pluginMap,
  compileMap,
  instrumentPredicate = () => true,
  cacheIgnore = false,
  cacheTrackHit = true,
  cacheStrategy = "etag",
  assetCacheIgnore = false,
  assetCacheStrategy = "etag",
}) => {
  await objectToPromiseAll({
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
  })

  const jsCompileFile = jsCompileToCompileFile(jsCompile, { localRoot, compileInto })

  const compileParamMap = compileMapToCompileParamMap(compileMap, pluginMap)
  const jsCompileService = jsCompileFileToService(jsCompileFile, {
    localRoot,
    compileInto,
    compileParamMap,
    cacheIgnore,
    cacheTrackHit,
    cacheStrategy,
    assetCacheIgnore,
    assetCacheStrategy,
    instrumentPredicate,
  })

  return jsCompileService
}
