import { createCancellationToken } from "@dmail/cancellation"
import { fileWrite } from "@dmail/helper"
import { jsCompile } from "../jsCompile/index.js"
import { jsCompileToService } from "../jsCompileToService/index.js"
import {
  generateGroupMap,
  browserScoreMap as browserDefaultScoreMap,
  nodeScoreMap as nodeDefaultScoreMap,
} from "../group-map/index.js"
import { wrapImportMap } from "../import-map/wrapImportMap.js"
import { objectMapValue } from "../objectHelper.js"

export const createJsCompileService = async ({
  cancellationToken = createCancellationToken(),
  importMap = {},
  projectFolder,
  compileInto,
  compileGroupCount,
  babelConfigMap,
  babelCompatMap,
  locate,
  browserScoreMap = browserDefaultScoreMap,
  nodeScoreMap = nodeDefaultScoreMap,
  localCacheStrategy,
  localCacheTrackHit,
  cacheStrategy,
  watch,
  watchPredicate,
}) => {
  const groupMap = generateGroupMap({
    babelConfigMap,
    babelCompatMap,
    platformScoreMap: { ...browserScoreMap, ...nodeScoreMap },
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
    }
  })

  await Promise.all([
    fileWrite(
      `${projectFolder}/${compileInto}/groupMap.json`,
      JSON.stringify(groupMap, null, "  "),
    ),
    fileWrite(
      `${projectFolder}/${compileInto}/importMap.json`,
      JSON.stringify(importMap, null, "  "),
    ),
    ...Object.keys(compileDescription).map((compileId) =>
      writeGroupImportMapFile({
        importMap,
        projectFolder,
        compileInto,
        compileId,
      }),
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

const writeGroupImportMapFile = ({ projectFolder, compileInto, compileId, importMap }) => {
  const groupImportMap = wrapImportMap(importMap, `${compileInto}/${compileId}`)

  return fileWrite(
    `${projectFolder}/${compileInto}/importMap.${compileId}.json`,
    JSON.stringify(groupImportMap, null, "  "),
  )
}
