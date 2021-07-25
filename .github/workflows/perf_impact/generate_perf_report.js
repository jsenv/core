import { measurePerformanceMultipleTimes, computeMetricsMedian } from "@jsenv/perf-impact"

import { executeFile } from "./file_execution.js "

const executeAndLog = process.argv.includes("--log")

export const generatePerformanceReport = async () => {
  const importingPackageMetrics = await measureImportingJsenvCorePackage()
  const startExploringMetrics = await measureStartExploringMetrics()
  const buildProjectMetrics = await measureBuildProjectMetrics()

  return {
    groups: {
      "importing @jsenv/core": {
        ...importingPackageMetrics,
      },
      "starting exploring server": {
        ...startExploringMetrics,
      },
      "building a simple project": {
        ...buildProjectMetrics,
      },
    },
  }
}

const measureImportingJsenvCorePackage = async () => {
  return getMetricsFromFile(
    new URL("./measure_importing_package/measure_importing_jsenv_core_package.js", import.meta.url),
    {
      iterationCount: 10,
    },
  )
}

const measureStartExploringMetrics = async () => {
  return getMetricsFromFile(
    new URL("./measure_exploring/measure_start_exploring.js", import.meta.url),
    {
      iterationCount: 5,
    },
  )
}

const measureBuildProjectMetrics = async () => {
  return getMetricsFromFile(new URL("./measure_build/measure_build.js", import.meta.url), {
    iterationCount: 5,
  })
}

const getMetricsFromFile = async (
  fileUrl,
  { iterationCount = 5, msToWaitBetweenEachMeasure = 100 } = {},
) => {
  const metrics = await measurePerformanceMultipleTimes(
    async () => {
      const messages = await executeFile(fileUrl)
      const { namespace } = messages[0]
      const {
        msEllapsed,
        // "When using Worker threads, rss will be a value that is valid for the entire process, while the other fields will only refer to the current thread."
        // see https://nodejs.org/docs/latest-v16.x/api/process.html#process_process_memoryusage
        // for this reason we use worker to ensure heapUsed is measured
        // only for the worker.
        heapUsed,
        fileSystemReadOperationCount,
        fileSystemWriteOperationCount,
      } = namespace

      return {
        "time": {
          type: "duration",
          value: msEllapsed,
        },
        "memory heap used": {
          type: "memory",
          value: heapUsed,
        },
        "number of filesystem read": {
          type: "count",
          value: fileSystemReadOperationCount,
        },
        "number of filesystem write": {
          type: "count",
          value: fileSystemWriteOperationCount,
        },
      }
    },
    iterationCount,
    {
      msToWaitBetweenEachMeasure,
    },
  )
  return computeMetricsMedian(metrics)
}

if (executeAndLog) {
  const performanceReport = await generatePerformanceReport()
  console.log(JSON.stringify(performanceReport, null, "  "))
}
