import { uneval } from "@jsenv/uneval"
// do not use memoize from @jsenv/util to avoid pulling @jsenv/util code into the node build
import { memoize } from "../../memoize.js"
import { nodeSupportsDynamicImport } from "../node-feature-detect/nodeSupportsDynamicImport.js"
import { nodeSupportsTopLevelAwait } from "../node-feature-detect/nodeSupportsTopLevelAwait.js"
import { fetchSource } from "./fetchSource.js"
import { computeCompileIdFromGroupId } from "../computeCompileIdFromGroupId.js"
import { resolveNodeGroup } from "../resolveNodeGroup.js"
import { createNodeSystem } from "./createNodeSystem.js"

const memoizedCreateNodeSystem = memoize(createNodeSystem)

export const createNodeRuntime = async ({
  projectDirectoryUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,
  defaultNodeModuleResolution,
}) => {
  const outDirectoryServerUrl = `${projectDirectoryUrl}${outDirectoryRelativeUrl}`
  const groupMapServerUrl = String(new URL("groupMap.json", outDirectoryServerUrl))
  const groupMap = await importJson(groupMapServerUrl)

  const compileId = computeCompileIdFromGroupId({
    groupId: resolveNodeGroup(groupMap),
    groupMap,
  })
  const groupInfo = groupMap[compileId]
  // eslint-disable-next-line no-unused-vars
  const canBypassCompilation = await nodeRuntimeSupportsAllFeatures(groupInfo)
  // TODO: if can by pass compilation, bypass it

  const compileDirectoryRelativeUrl = `${outDirectoryRelativeUrl}${compileId}/`

  const importFile = async (specifier) => {
    const nodeSystem = await memoizedCreateNodeSystem({
      projectDirectoryUrl,
      compileServerOrigin,
      compileDirectoryRelativeUrl,
      fetchSource,
      defaultNodeModuleResolution,
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
      compileDirectoryRelativeUrl,
      fetchSource,
      defaultNodeModuleResolution,
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
  if (value.hasOwnProperty("toString")) {
    delete value.toString
  }
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

const nodeRuntimeSupportsAllFeatures = async (groupInfo) => {
  // TODO: if only the codevrage instrumentation plugins exists
  // and once we collect coverage using v8,
  // we can consider it is not required
  if (Object.keys(groupInfo.babelPluginRequiredNameArray).length > 0) {
    return false
  }

  if (Object.keys(groupInfo.jsenvPluginRequiredNameArray).length > 0) {
    return false
  }

  const hasDynamicImport = await nodeSupportsDynamicImport()
  if (!hasDynamicImport) {
    return false
  }

  const hasTopLevelAwait = await nodeSupportsTopLevelAwait()
  if (!hasTopLevelAwait) {
    return false
  }

  return true
}
