import { uneval } from "@jsenv/uneval"
import { normalizeImportMap } from "@jsenv/import-map/src/normalizeImportMap.js"
import { resolveImport } from "@jsenv/import-map/src/resolveImport.js"
import { memoize } from "../../memoize.js"
import { fetchUrl } from "../../fetchUrl.js"
import { computeCompileIdFromGroupId } from "../computeCompileIdFromGroupId.js"
import { resolveNodeGroup } from "../resolveNodeGroup.js"
import { isNativeNodeModuleBareSpecifier } from "./isNativeNodeModuleBareSpecifier.js"
import { createNodeSystem } from "./createNodeSystem.js"

const GLOBAL_SPECIFIER = "global"
const memoizedCreateNodeSystem = memoize(createNodeSystem)

export const createNodePlatform = async ({
  projectDirectoryUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,
}) => {
  const outDirectoryUrl = `${projectDirectoryUrl}${outDirectoryRelativeUrl}`
  const groupMapUrl = String(new URL("groupMap.json", outDirectoryUrl))
  const importMapUrl = String(new URL("importMap.json", outDirectoryUrl))
  const envUrl = String(new URL("env.json", outDirectoryUrl))
  const [groupMap, importMap, { importDefaultExtension }] = await Promise.all([
    importJson(groupMapUrl),
    importJson(importMapUrl),
    importJson(envUrl),
  ])

  const compileId = computeCompileIdFromGroupId({
    groupId: resolveNodeGroup({ groupMap }),
    groupMap,
  })
  const outDirectoryRemoteUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}`
  const compileDirectoryRemoteUrl = `${outDirectoryRemoteUrl}${compileId}/`
  const importMapNormalized = normalizeImportMap(importMap, compileDirectoryRemoteUrl)

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
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      compileServerOrigin,
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
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      compileServerOrigin,
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
    compileDirectoryRemoteUrl,
    resolveImport: resolveImportScoped,
    importFile,
    executeFile,
  }
}

const importJson = async (url) => {
  const response = await fetchUrl(url, { simplified: false, ignoreHttpsError: true })
  const object = await response.json()
  return object
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
