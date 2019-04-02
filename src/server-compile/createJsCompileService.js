import { createCancellationToken } from "@dmail/cancellation"
import { fileWrite } from "@dmail/helper"
import { jsCompile } from "../jsCompile/index.js"
import { jsCompileToService } from "../jsCompileToService/index.js"
import {
  generateGroupMap,
  browserScoring as browserDefaultScoring,
  nodeScoring as nodeDefaultScoring,
} from "../group-description/index.js"
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
  browserScoring = browserDefaultScoring,
  nodeScoring = nodeDefaultScoring,
  localCacheStrategy,
  localCacheTrackHit,
  cacheStrategy,
  watch,
  watchPredicate,
}) => {
  const groupMap = generateGroupMap({
    babelConfigMap,
    babelCompatMap,
    platformScoring: { ...browserScoring, ...nodeScoring },
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
