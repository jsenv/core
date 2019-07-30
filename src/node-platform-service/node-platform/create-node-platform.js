import {
  compileIntoRelativePath,
  groupMap,
  importDefaultExtension,
  // "/.jsenv/node-platform-data.js" resolved at build time
  // eslint-disable-next-line import/no-unresolved
} from "/.jsenv/node-platform-data.js"
// "/.jsenv/import-map.json" resolved at build time
// eslint-disable-next-line import/no-unresolved
import importMap from "/.jsenv/import-map.json"
import { resolvePath } from "@jsenv/module-resolution"
import { isNativeNodeModuleBareSpecifier } from "@jsenv/module-resolution/src/isNativeNodeModuleBareSpecifier.js"
import { uneval } from "@dmail/uneval"
import { memoizeOnce } from "@dmail/helper/src/memoizeOnce.js"
import { computeCompileIdFromGroupId, resolveNodeGroup } from "@jsenv/grouping"
import { wrapImportMap } from "../../import-map/wrapImportMap.js"
import { createNodeSystem } from "./create-node-system.js"

const GLOBAL_SPECIFIER = "global"
const memoizedCreateNodeSystem = memoizeOnce(createNodeSystem)

export const createNodePlatform = ({ compileServerOrigin, projectPathname }) => {
  const compileId = computeCompileIdFromGroupId({
    groupId: resolveNodeGroup({ groupMap }),
    groupMap,
  })

  const relativePathToCompiledHref = (relativePath) => {
    return `${compileServerOrigin}${compileIntoRelativePath}/${compileId}${relativePath}`
  }

  const wrappedImportMap = wrapImportMap(
    importMap,
    `${compileIntoRelativePath.slice(1)}/${compileId}`,
  )

  const resolveImport = (specifier, importer) => {
    if (specifier === GLOBAL_SPECIFIER) return specifier

    if (isNativeNodeModuleBareSpecifier(specifier)) return specifier

    return resolvePath({
      specifier,
      importer,
      importMap: wrappedImportMap,
      defaultExtension: importDefaultExtension,
    })
  }

  const importFile = async (specifier) => {
    const nodeSystem = await memoizedCreateNodeSystem({
      compileServerOrigin,
      projectPathname,
      compileIntoRelativePath,
      resolveImport,
    })
    return makePromiseKeepNodeProcessAlive(nodeSystem.import(specifier))
  }

  const executeFile = async (
    specifier,
    {
      collectCoverage,
      collectNamespace,
      executionId,
      errorExposureInConsole = true,
      errorTransform = (error) => error,
    } = {},
  ) => {
    const nodeSystem = await memoizedCreateNodeSystem({
      compileServerOrigin,
      projectPathname,
      compileIntoRelativePath,
      resolveImport,
      executionId,
    })
    try {
      const namespace = await makePromiseKeepNodeProcessAlive(nodeSystem.import(specifier))
      return {
        status: "completed",
        namespace: collectNamespace ? namespace : undefined,
        coverageMap: collectCoverage ? readCoverage() : undefined,
      }
    } catch (error) {
      let transformedError
      try {
        transformedError = await errorTransform(error)
      } catch (e) {
        transformedError = error
      }

      if (errorExposureInConsole) console.error(transformedError)

      return {
        status: "errored",
        exceptionSource: unevalException(transformedError),
        coverageMap: collectCoverage ? readCoverage() : undefined,
      }
    }
  }

  return {
    relativePathToCompiledHref,
    resolveImport,
    importFile,
    executeFile,
  }
}

const unevalException = (value) => {
  return uneval(value)
}

const readCoverage = () => global.__coverage__

const makePromiseKeepNodeProcessAlive = async (promise) => {
  const timerId = setInterval(() => {}, 10000)

  try {
    const value = await promise
    return value
  } finally {
    clearInterval(timerId)
  }
}
