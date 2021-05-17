import { nodeRuntime } from "../../nodeRuntime.js"
import { PerformanceObserver, performance } from "perf_hooks"

export const execute = async ({
  projectDirectoryUrl,
  fileRelativeUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,
  executionId,
  // do not log in the console
  // because error handling becomes responsability
  // of node code launching node process
  // it avoids seeing error in runtime logs during testing
  errorExposureInConsole = false,
  collectCoverage,
  collectPerfMetrics,
  measurePerf = collectPerfMetrics,
  nodeRuntimeDecision,
}) => {
  let finalizeExecutionResult = (result) => result

  if (collectPerfMetrics) {
    const perfMetrics = {}
    // https://nodejs.org/dist/latest-v16.x/docs/api/perf_hooks.html
    const perfObserver = new PerformanceObserver(
      (
        // https://nodejs.org/dist/latest-v16.x/docs/api/perf_hooks.html#perf_hooks_class_performanceobserverentrylist
        list,
      ) => {
        const perfEntries = list.getEntries()
        perfEntries.forEach(
          (
            // https://nodejs.org/dist/latest-v16.x/docs/api/perf_hooks.html#perf_hooks_class_performanceentry
            perfEntry,
          ) => {
            if (perfEntry.entryType === "measure") {
              perfMetrics[perfEntry.name] = perfEntry.duration
            }
          },
        )
      },
    )
    perfObserver.observe({ type: "measure" })

    finalizeExecutionResult = (executionResult) => {
      performance.clearMarks()
      perfObserver.disconnect()
      return {
        ...executionResult,
        perfMetrics,
      }
    }
  }

  const { executeFile } = await nodeRuntime.create({
    projectDirectoryUrl,
    compileServerOrigin,
    outDirectoryRelativeUrl,
    nodeRuntimeDecision,
  })

  const executionResult = await executeFile(fileRelativeUrl, {
    executionId,
    errorExposureInConsole,
    collectCoverage,
    measurePerf,
  })

  return finalizeExecutionResult({
    ...executionResult,
    indirectCoverage: global.__indirectCoverage__,
  })
}
