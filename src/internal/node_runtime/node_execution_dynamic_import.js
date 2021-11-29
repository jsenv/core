import { resolveUrl } from "@jsenv/filesystem"

import { unevalException } from "@jsenv/core/src/internal/unevalException.js"
import { measureAsyncFnPerf } from "@jsenv/core/src/internal/perf_node.js"
import { startObservingPerformances } from "./node_execution_performance.js"

export const execute = async ({
  projectDirectoryUrl,
  fileRelativeUrl,
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

  const executeFile = async (
    specifier,
    { measurePerformance, errorExposureInConsole = false } = {},
  ) => {
    // we can't dynamically import from compileServerOrigin I guess
    // we have to use the filesystem
    const fileUrl = resolveUrl(specifier, projectDirectoryUrl)
    const importWithDynamicImport = async () => {
      try {
        const status = "completed"
        const namespace = await import(fileUrl)

        return {
          status,
          namespace,
        }
      } catch (error) {
        if (errorExposureInConsole) console.error(error)
        const status = "errored"
        const exceptionSource = unevalException(error)
        return {
          status,
          exceptionSource,
        }
      }
    }
    if (measurePerformance) {
      return measureAsyncFnPerf(importWithDynamicImport, "jsenv_file_import")
    }
    return importWithDynamicImport()
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
