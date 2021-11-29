import { PerformanceObserver, performance } from "node:perf_hooks"

export const startObservingPerformances = () => {
  const measureEntries = []
  // https://nodejs.org/dist/latest-v16.x/docs/api/perf_hooks.html
  const perfObserver = new PerformanceObserver(
    (
      // https://nodejs.org/dist/latest-v16.x/docs/api/perf_hooks.html#perf_hooks_class_performanceobserverentrylist
      list,
    ) => {
      const perfMeasureEntries = list.getEntriesByType("measure")
      measureEntries.push(...perfMeasureEntries)
    },
  )
  perfObserver.observe({
    entryTypes: ["measure"],
  })
  return async () => {
    // wait for node to call the performance observer
    await new Promise((resolve) => {
      setTimeout(resolve)
    })
    performance.clearMarks()
    perfObserver.disconnect()
    return {
      ...readNodePerformance(),
      measures: measuresFromMeasureEntries(measureEntries),
    }
  }
}

const readNodePerformance = () => {
  const nodePerformance = {
    nodeTiming: asPlainObject(performance.nodeTiming),
    timeOrigin: performance.timeOrigin,
    eventLoopUtilization: performance.eventLoopUtilization(),
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

const measuresFromMeasureEntries = (measureEntries) => {
  const measures = {}
  // Sort to ensure measures order is predictable
  // It seems to be already predictable on Node 16+ but
  // it's not the case on Node 14.
  measureEntries.sort((a, b) => {
    return a.startTime - b.startTime
  })
  measureEntries.forEach(
    (
      // https://nodejs.org/dist/latest-v16.x/docs/api/perf_hooks.html#perf_hooks_class_performanceentry
      perfMeasureEntry,
    ) => {
      measures[perfMeasureEntry.name] = perfMeasureEntry.duration
    },
  )
  return measures
}
