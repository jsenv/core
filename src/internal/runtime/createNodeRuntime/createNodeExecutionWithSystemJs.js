import { resolveUrl } from "@jsenv/filesystem"

import { measureAsyncFnPerf } from "@jsenv/core/src/internal/perf_node.js"
import { unevalException } from "@jsenv/core/src/internal/unevalException.js"
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
  importDefaultExtension,
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
      importDefaultExtension,
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

  const executeFile = async (
    specifier,
    { measurePerformance, errorExposureInConsole = true } = {},
  ) => {
    const compiledFileRemoteUrl = resolveUrl(
      specifier,
      `${compileServerOrigin}/${compileDirectoryRelativeUrl}`,
    )

    const nodeSystem = await memoizedCreateNodeSystem({
      projectDirectoryUrl,
      compileServerOrigin,
      compileDirectoryRelativeUrl,
      fetchSource,
      importDefaultExtension,
    })

    const importWithSystemJs = async () => {
      try {
        const importPromise = nodeSystem.import(compiledFileRemoteUrl)
        const namespace = await makePromiseKeepNodeProcessAlive(importPromise)
        return {
          status: "completed",
          namespace,
          coverage: global.__coverage__,
        }
      } catch (error) {
        let transformedError
        try {
          transformedError = await errorTransformer(error)
        } catch (e) {
          transformedError = error
        }

        if (errorExposureInConsole) {
          console.error(transformedError)
        }

        return {
          status: "errored",
          exceptionSource: unevalException(transformedError),
          coverage: global.__coverage__,
        }
      }
    }

    if (measurePerformance) {
      return measureAsyncFnPerf(importWithSystemJs, "jsenv_file_import")
    }
    return importWithSystemJs()
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
