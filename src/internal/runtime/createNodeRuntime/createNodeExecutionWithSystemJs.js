import { uneval } from "@jsenv/uneval"
import { resolveUrl } from "@jsenv/util"
import { memoize } from "../../memoize.js"
import { installNodeErrorStackRemapping } from "../../error-stack-remapping/installNodeErrorStackRemapping.js"
import { fetchSource } from "./fetchSource.js"
import { createNodeSystem } from "./createNodeSystem.js"

const memoizedCreateNodeSystem = memoize(createNodeSystem)

export const createNodeExecutionWithSystemJs = ({
  projectDirectoryUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,
  compileId,
  defaultNodeModuleResolution,
}) => {
  const { getErrorOriginalStackString } = installNodeErrorStackRemapping({
    projectDirectoryUrl,
  })

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

  const errorTransformer = async (error) => {
    // code can throw something else than an error
    // in that case return it unchanged
    if (!error || !(error instanceof Error)) return error

    const originalStack = await getErrorOriginalStackString(error)
    error.stack = originalStack
    return error
  }

  const executeFile = async (specifier, { errorExposureInConsole = true } = {}) => {
    const compiledFileRemoteUrl = resolveUrl(
      specifier,
      `${compileServerOrigin}/${compileDirectoryRelativeUrl}`,
    )

    const nodeSystem = await memoizedCreateNodeSystem({
      projectDirectoryUrl,
      compileServerOrigin,
      compileDirectoryRelativeUrl,
      fetchSource,
      defaultNodeModuleResolution,
    })
    try {
      const namespace = await makePromiseKeepNodeProcessAlive(
        nodeSystem.import(compiledFileRemoteUrl),
      )
      return {
        status: "completed",
        namespace,
        readCoverage: () => global.__coverage__,
      }
    } catch (error) {
      let transformedError
      try {
        transformedError = await errorTransformer(error)
      } catch (e) {
        transformedError = error
      }

      if (errorExposureInConsole) console.error(transformedError)

      return {
        status: "errored",
        exceptionSource: unevalException(transformedError),
        readCoverage: () => global.__coverage__,
      }
    }
  }

  return {
    compileDirectoryRelativeUrl,
    importFile,
    executeFile,
  }
}

const makePromiseKeepNodeProcessAlive = async (promise) => {
  const timerId = setInterval(() => {}, 10000)

  try {
    const value = await promise
    return value
  } finally {
    clearInterval(timerId)
  }
}

const unevalException = (value) => {
  if (value.hasOwnProperty("toString")) {
    delete value.toString
  }
  return uneval(value)
}
