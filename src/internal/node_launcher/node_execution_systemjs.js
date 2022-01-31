import { resolveUrl } from "@jsenv/filesystem"

import { unevalException } from "@jsenv/core/src/internal/runtime_client/uneval_exception.js"

import { installNodeErrorStackRemapping } from "./node_error_stack_remap.js"
import { startObservingPerformances } from "./node_execution_performance.js"
import { measureAsyncFnPerf } from "./perf_node.js"
import { fetchSource } from "./fetch_source.js"
import { createNodeSystem } from "./node_system.js"

export const execute = async ({
  projectDirectoryUrl,
  compileServerOrigin,
  fileRelativeUrl,
  jsenvDirectoryRelativeUrl,
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
  const compileDirectoryRelativeUrl = `${jsenvDirectoryRelativeUrl}${compileId}/`

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
