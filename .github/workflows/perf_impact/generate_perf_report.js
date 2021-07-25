import { measurePerformanceMultipleTimes, computeMetricsMedian } from "@jsenv/perf-impact"

import { executeFile } from "./file_execution.js "

const executeAndLog = process.argv.includes("--log")

export const generatePerformanceReport = async () => {
  const importingPackageMetrics = await measureImportingJsenvCorePackage()

  return {
    groups: {
      "importing @jsenv/core": {
        ...importingPackageMetrics,
      },
    },
  }
}

const measureImportingJsenvCorePackage = async () => {
  const fileUrl = new URL("./measure_importing_jsenv_core_package.js", import.meta.url)

  const metrics = await measurePerformanceMultipleTimes(
    async () => {
      const messages = await executeFile(fileUrl)
      const { namespace } = messages[0]
      const {
        userCPUTime,
        // "When using Worker threads, rss will be a value that is valid for the entire process, while the other fields will only refer to the current thread."
        // see https://nodejs.org/docs/latest-v16.x/api/process.html#process_process_memoryusage
        // for this reason we use worker to ensure heapUsed is measured
        // only for the worker.
        heapUsed,
        fileSystemReadOperationCount,
        fileSystemWriteOperationCount,
      } = namespace

      return {
        "user CPU time": {
          type: "duration",
          value: userCPUTime / 1000, // convert to ms
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
    10,
    {
      msToWaitBetweenEachMeasure: 200,
    },
  )
  if (executeAndLog) {
    console.log(metrics)
  }
  return computeMetricsMedian(metrics)
}

if (executeAndLog) {
  const performanceReport = await generatePerformanceReport()
  console.log(performanceReport)
}
