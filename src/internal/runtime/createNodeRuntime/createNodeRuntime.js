import { normalizeImportMap } from "@jsenv/import-map"
import { uneval } from "@jsenv/uneval"
// do not use memoize from @jsenv/util to avoid pulling @jsenv/util code into the node build
import { memoize } from "../../memoize.js"
import { fetchUrl } from "../../fetchUrl.js"
import { fetchSource } from "./fetchSource.js"
import { computeCompileIdFromGroupId } from "../computeCompileIdFromGroupId.js"
import { resolveNodeGroup } from "../resolveNodeGroup.js"
import { createNodeSystem } from "./createNodeSystem.js"

const memoizedCreateNodeSystem = memoize(createNodeSystem)

export const createNodeRuntime = async ({
  projectDirectoryUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,
}) => {
  const outDirectoryUrl = `${projectDirectoryUrl}${outDirectoryRelativeUrl}`
  const groupMapUrl = String(new URL("groupMap.json", outDirectoryUrl))
  const envUrl = String(new URL("env.json", outDirectoryUrl))
  const [groupMap, { importMapFileRelativeUrl, importDefaultExtension }] = await Promise.all([
    importJson(groupMapUrl),
    importJson(envUrl),
  ])
  const compileId = computeCompileIdFromGroupId({
    groupId: resolveNodeGroup(groupMap),
    groupMap,
  })
  const compileDirectoryRelativeUrl = `${outDirectoryRelativeUrl}${compileId}/`

  let importMap
  let importMapUrl
  if (importMapFileRelativeUrl) {
    importMapUrl = `${compileServerOrigin}/${compileDirectoryRelativeUrl}${importMapFileRelativeUrl}`
    const importmapFileResponse = await fetchUrl(importMapUrl)
    const importmap = importmapFileResponse.status === 404 ? {} : await importmapFileResponse.json()
    const importmapNormalized = normalizeImportMap(importmap, importMapUrl)
    importMap = importmapNormalized
  }

  const importFile = async (specifier) => {
    const nodeSystem = await memoizedCreateNodeSystem({
      projectDirectoryUrl,
      compileServerOrigin,
      outDirectoryRelativeUrl,
      importMapUrl,
      importMap,
      importDefaultExtension,
      fetchSource,
    })
    return makePromiseKeepNodeProcessAlive(nodeSystem.import(specifier))
  }

  const executeFile = async (
    specifier,
    { errorExposureInConsole = true, errorTransform = (error) => error } = {},
  ) => {
    const nodeSystem = await memoizedCreateNodeSystem({
      projectDirectoryUrl,
      compileServerOrigin,
      outDirectoryRelativeUrl,
      importMapUrl,
      importMap,
      importDefaultExtension,
      fetchSource,
    })
    try {
      const namespace = await makePromiseKeepNodeProcessAlive(nodeSystem.import(specifier))
      return {
        status: "completed",
        namespace,
        coverageMap: readCoverage(),
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
        coverageMap: readCoverage(),
      }
    }
  }

  return {
    compileDirectoryRelativeUrl,
    importFile,
    executeFile,
  }
}

const importJson = async (url) => {
  const response = await fetchSource(url)
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
