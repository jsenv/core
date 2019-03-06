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
import { objectMap } from "../objectHelper.js"

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
  instrumentPredicate,
  watch,
  watchPredicate,
}) => {
  const groupDescription = generateGroupDescription({
    babelPluginDescription,
    platformScoring: { ...browserScoring, ...nodeScoring },
    groupCount: compileGroupCount,
    babelPluginCompatibilityDescription,
  })

  await Promise.all([
    fileWriteFromString(
      `${projectFolder}/${compileInto}/groupDescription.json`,
      JSON.stringify(groupDescription, null, "  "),
    ),
    ...Object.keys(groupDescription).map((compileId) =>
      writeGroupImportMapFile({
        importMap,
        projectFolder,
        compileInto,
        compileId,
      }),
    ),
  ])

  const compileDescription = groupDescriptionToCompileDescription(
    groupDescription,
    babelPluginDescription,
  )

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

const writeGroupImportMapFile = ({ projectFolder, compileInto, compileId, importMap }) => {
  const prefix = `/${compileInto}/${compileId}`

  const prefixedImportMap = {
    imports: prefixImports(importMap.imports || {}, prefix),
    scopes: prefixScopes(importMap.scopes || {}, prefix),
  }

  const compileFolderImportMap = {
    scopes: {
      [`${prefix}/`]: {
        "/": `${prefix}/`,
      },
    },
  }
  const groupImportMap = mergeImportMap(prefixedImportMap, compileFolderImportMap)

  return fileWriteFromString(
    `${projectFolder}/${compileInto}/importMap.${compileId}.json`,
    JSON.stringify(groupImportMap, null, "  "),
  )
}

const prefixImports = (imports, prefix) =>
  objectMap(imports, (pathnameMatchPattern, pathnameRemapPattern) => {
    return {
      [`${prefix}${pathnameMatchPattern}`]: `${prefix}${pathnameRemapPattern}`,
    }
  })

const prefixScopes = (scopes, prefix) =>
  objectMap(scopes, (pathnameMatchPattern, scopeImports) => {
    return {
      [`${prefix}${pathnameMatchPattern}`]: prefixImports(scopeImports, prefix),
    }
  })

const mergeImportMap = (...importMaps) =>
  importMaps.reduce(
    (previous, current) => {
      return {
        imports: { ...previous.imports, ...(current.imports || {}) },
        scopes: { ...previous.scopes, ...(current.scopes || {}) },
      }
    },
    { imports: {}, scopes: {} },
  )
