import { resolveUrl } from "@jsenv/filesystem"

import { measureAsyncFnPerf } from "@jsenv/core/src/internal/perf_node.js"
import { startObservingPerformances } from "./node_execution_performance.js"
import { unevalException } from "@jsenv/core/src/internal/unevalException.js"

import { installNodeErrorStackRemapping } from "@jsenv/core/src/internal/error-stack-remapping/installNodeErrorStackRemapping.js"
import { fetchSource } from "@jsenv/core/src/internal/node_runtime/fetchSource.js"
import { createNodeSystem } from "@jsenv/core/src/internal/node_runtime/node_system.js"

export const execute = async ({
  projectDirectoryUrl,
  compileServerOrigin,
  fileRelativeUrl,
  outDirectoryRelativeUrl,
  compileId,
  importDefaultExtension,
  // do not log in the console
  // because error handling becomes responsability
  // of node code launching node process
  // it avoids seeing error in runtime logs during testing
  errorExposureInConsole = false,
  collectCoverage,
  measurePerformance,
  collectPerformance,
}) => {
  let finalizeExecutionResult = (result) => result

  if (collectPerformance) {
    const getPerformance = startObservingPerformances()
    finalizeExecutionResult = async (executionResult) => {
      const performance = await getPerformance()
      return {
        ...executionResult,
        performance,
      }
    }
  }

  const { getErrorOriginalStackString } = installNodeErrorStackRemapping({
    projectDirectoryUrl,
  })

  const compileDirectoryRelativeUrl = `${outDirectoryRelativeUrl}${compileId}/`

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

    const nodeSystem = await createNodeSystem({
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

  const executionResult = await executeFile(fileRelativeUrl, {
    errorExposureInConsole,
    measurePerformance,
    collectCoverage,
  })

  return finalizeExecutionResult({
    ...executionResult,
    indirectCoverage: global.__indirectCoverage__,
  })
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
