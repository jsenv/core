/* eslint-disable import/max-dependencies */
import {
  compileDirectoryRelativePath,
  groupMap,
  importDefaultExtension,
  // eslint-disable-next-line import/no-unresolved
} from "/.jsenv/node-platform-data.js"
// eslint-disable-next-line import/no-unresolved
import importMap from "/.jsenv/compileServerImportMap.json"
import { uneval } from "@jsenv/uneval"
import { normalizeImportMap } from "@jsenv/import-map/src/normalizeImportMap/normalizeImportMap.js"
import { resolveImport } from "@jsenv/import-map/src/resolveImport/resolveImport.js"
import { computeCompileIdFromGroupId } from "../computeCompileIdFromGroupId.js"
import { resolveNodeGroup } from "../resolveNodeGroup.js"
import { memoizeOnce } from "../memoizeOnce.js"
import { isNativeNodeModuleBareSpecifier } from "./isNativeNodeModuleBareSpecifier.js"
import { createNodeSystem } from "./createNodeSystem.js"

const GLOBAL_SPECIFIER = "global"
const memoizedCreateNodeSystem = memoizeOnce(createNodeSystem)

export const createNodePlatform = ({ compileServerOrigin, projectDirectoryUrl }) => {
  const compileId = computeCompileIdFromGroupId({
    groupId: resolveNodeGroup({ groupMap }),
    groupMap,
  })

  const relativePathToCompiledUrl = (relativePath) => {
    return `${compileServerOrigin}/${compileDirectoryRelativePath}${compileId}/${relativePath}`
  }

  const importMapNormalized = normalizeImportMap(
    importMap,
    `${compileServerOrigin}/${compileDirectoryRelativePath}${compileId}/`,
  )

  const resolveImportScoped = (specifier, importer) => {
    if (specifier === GLOBAL_SPECIFIER) return specifier

    if (isNativeNodeModuleBareSpecifier(specifier)) return specifier

    return resolveImport({
      specifier,
      importer,
      importMap: importMapNormalized,
      defaultExtension: importDefaultExtension,
    })
  }

  const importFile = async (specifier) => {
    const nodeSystem = await memoizedCreateNodeSystem({
      compileServerOrigin,
      projectDirectoryUrl,
      compileDirectoryRelativePath,
      resolveImport: resolveImportScoped,
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
      projectDirectoryUrl,
      compileDirectoryRelativePath,
      resolveImport: resolveImportScoped,
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
    relativePathToCompiledUrl,
    resolveImport: resolveImportScoped,
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
