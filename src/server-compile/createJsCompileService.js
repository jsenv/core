import { createCancellationToken } from "@dmail/cancellation"
import { fileWriteFromString } from "@dmail/project-structure-compile-babel"
import { jsCompile } from "../jsCompile/index.js"
import { jsCompileToService } from "../jsCompileToService/index.js"
import {
  generateCompileMap,
  compileMapToCompileParamMap,
  browserScoring as browserDefaultScoring,
  nodeScoring as nodeDefaultScoring,
} from "../compile-group/index.js"

export const createJsCompileService = async ({
  cancellationToken = createCancellationToken(),
  projectFolder,
  compileInto,
  compileGroupCount,
  babelPluginDescription,
  pluginCompatMap,
  locate,
  browserScoring = browserDefaultScoring,
  nodeScoring = nodeDefaultScoring,
  localCacheStrategy,
  localCacheTrackHit,
  cacheStrategy,
  instrumentPredicate,
  watch,
  watchPredicate,
}) => {
  const compileMap = generateCompileMap({
    compileGroupCount,
    babelPluginDescription,
    pluginCompatMap,
    platformScoring: { ...browserScoring, ...nodeScoring },
  })

  await fileWriteFromString(
    `${projectFolder}/${compileInto}/compileMap.json`,
    JSON.stringify(compileMap, null, "  "),
  )

  const compileDescription = compileMapToCompileParamMap(compileMap, babelPluginDescription)

  const jsCompileService = jsCompileToService(jsCompile, {
    cancellationToken,
    projectFolder,
    compileInto,
    localCacheStrategy,
    localCacheTrackHit,
    cacheStrategy,
    instrumentPredicate,
    watch,
    watchPredicate,
    locate,
    compileDescription,
  })

  return jsCompileService
}
