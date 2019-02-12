import { createCancellationToken } from "@dmail/cancellation"
import { fileWriteFromString } from "@dmail/project-structure-compile-babel"
import { jsCompile } from "../jsCompile/index.js"
import { jsCompileToService } from "../jsCompileToService/index.js"
import {
  generateCompileMap,
  compileMapToCompileParamMap,
  browserUsageMap as browserDefaultUsageMap,
  nodeUsageMap as nodeDefaultUsageMap,
} from "../compile-group/index.js"

export const createJsCompileService = async ({
  cancellationToken = createCancellationToken(),
  root,
  compileInto,
  compileGroupCount,
  pluginMap,
  pluginCompatMap,
  locate,
  browserUsageMap = browserDefaultUsageMap,
  nodeUsageMap = nodeDefaultUsageMap,
  localCacheStrategy,
  localCacheTrackHit,
  cacheStrategy,
  instrumentPredicate,
  watch,
  watchPredicate,
}) => {
  const compileMap = generateCompileMap({
    compileGroupCount,
    pluginMap,
    pluginCompatMap,
    platformUsageMap: { ...browserUsageMap, ...nodeUsageMap },
  })

  await fileWriteFromString(
    `${root}/${compileInto}/compileMap.json`,
    JSON.stringify(compileMap, null, "  "),
  )

  const compileParamMap = compileMapToCompileParamMap(compileMap, pluginMap)

  const jsCompileService = jsCompileToService(jsCompile, {
    cancellationToken,
    root,
    compileInto,
    localCacheStrategy,
    localCacheTrackHit,
    cacheStrategy,
    instrumentPredicate,
    watch,
    watchPredicate,
    locate,
    compileParamMap,
  })

  return jsCompileService
}
