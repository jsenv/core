import { createCancellationToken } from "@dmail/cancellation"
import { fileWriteFromString } from "@dmail/project-structure-compile-babel"
import { jsCompile } from "../jsCompile/index.js"
import { jsCompileToService } from "../jsCompileToService/index.js"
import {
  generateGroupDescription,
  groupDescriptionToCompileDescription,
  browserScoring as browserDefaultScoring,
  nodeScoring as nodeDefaultScoring,
} from "../group-description/index.js"
import { wrapImportMap } from "../import-map/wrapImportMap.js"

export const createJsCompileService = async ({
  cancellationToken = createCancellationToken(),
  importMap = {},
  projectFolder,
  compileInto,
  compileGroupCount,
  babelPluginDescription,
  babelPluginCompatibilityDescription,
  locate,
  browserScoring = browserDefaultScoring,
  nodeScoring = nodeDefaultScoring,
  localCacheStrategy,
  localCacheTrackHit,
  cacheStrategy,
  watch,
  watchPredicate,
}) => {
  const groupDescription = generateGroupDescription({
    babelPluginDescription,
    platformScoring: { ...browserScoring, ...nodeScoring },
    groupCount: compileGroupCount,
    babelPluginCompatibilityDescription,
  })

  const compileDescription = groupDescriptionToCompileDescription(
    groupDescription,
    babelPluginDescription,
  )

  await Promise.all([
    fileWriteFromString(
      `${projectFolder}/${compileInto}/groupDescription.json`,
      JSON.stringify(groupDescription, null, "  "),
    ),
    fileWriteFromString(
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

  return fileWriteFromString(
    `${projectFolder}/${compileInto}/importMap.${compileId}.json`,
    JSON.stringify(groupImportMap, null, "  "),
  )
}
