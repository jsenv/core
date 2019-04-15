import { createCancellationToken } from "/node_modules/@dmail/cancellation/index.js"
import { fileWrite } from "/node_modules/@dmail/helper/index.js"
import { jsCompile } from "../jsCompile/index.js"
import { jsCompileToService } from "../jsCompileToService/index.js"
import {
  generateGroupMap,
  browserScoreMap as browserDefaultScoreMap,
  nodeVersionScoreMap as nodeDefaultVersionScoreMap,
} from "../group-map/index.js"
import { objectMapValue } from "../objectHelper.js"

export const createJsCompileService = async ({
  cancellationToken = createCancellationToken(),
  projectFolder,
  compileInto,
  compileGroupCount,
  babelConfigMap,
  babelCompatMap,
  locate,
  browserScoreMap = browserDefaultScoreMap,
  nodeVersionScoreMap = nodeDefaultVersionScoreMap,
  localCacheStrategy,
  localCacheTrackHit,
  cacheStrategy,
  watch,
  watchPredicate,
  transformTopLevelAwait,
  enableGlobalLock,
}) => {
  const groupMap = generateGroupMap({
    babelConfigMap,
    babelCompatMap,
    platformScoreMap: { ...browserScoreMap, node: nodeVersionScoreMap },
    groupCount: compileGroupCount,
  })

  const compileDescription = objectMapValue(groupMap, (group) => {
    const groupBabelConfigMap = {}

    group.incompatibleNameArray.forEach((incompatibleFeatureName) => {
      if (incompatibleFeatureName in babelConfigMap) {
        groupBabelConfigMap[incompatibleFeatureName] = babelConfigMap[incompatibleFeatureName]
      }
    })

    return {
      babelConfigMap: groupBabelConfigMap,
      transformTopLevelAwait,
      enableGlobalLock,
    }
  })

  await Promise.all([
    fileWrite(
      `${projectFolder}/${compileInto}/groupMap.json`,
      JSON.stringify(groupMap, null, "  "),
    ),
  ])

  const jsCompileService = jsCompileToService(jsCompile, {
    cancellationToken,
    projectFolder,
    compileInto,
    localCacheStrategy,
    localCacheTrackHit,
    cacheStrategy,
    watch,
    watchPredicate,
    locate,
    compileDescription,
  })

  return jsCompileService
}
