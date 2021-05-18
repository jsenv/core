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
  measurePerformance,
  collectPerformance,
  nodeRuntimeDecision,
}) => {
  let finalizeExecutionResult = (result) => result

  if (collectPerformance) {
    const measures = {}
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
              measures[perfEntry.name] = perfEntry.duration
            }
          },
        )
      },
    )
    // perfObserver.observe()
    perfObserver.observe({
      entryTypes: ["measure"],
    })

    finalizeExecutionResult = (executionResult) => {
      performance.clearMarks()
      perfObserver.disconnect()
      return {
        ...executionResult,
        performance: {
          ...readNodePerformance(),
          measures,
        },
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
    measurePerformance,
  })

  return finalizeExecutionResult({
    ...executionResult,
    indirectCoverage: global.__indirectCoverage__,
  })
}

const readNodePerformance = () => {
  const nodePerformance = {
    nodeTiming: asPlainObject(performance.nodeTiming),
    timeOrigin: performance.timeOrigin,
    eventLoopUtilization: asPlainObject(performance.eventLoopUtilization()),
  }
  return nodePerformance
}

// remove getters that cannot be stringified
const asPlainObject = (objectWithGetters) => {
  const objectWithoutGetters = {}
  Object.keys(objectWithGetters).forEach((key) => {
    objectWithoutGetters[key] = objectWithGetters[key]
  })
  return objectWithoutGetters
}
