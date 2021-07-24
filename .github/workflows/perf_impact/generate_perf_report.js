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
      const { namespace } = await executeFile(fileUrl)
      const {
        userCPUTime,
        systemCPUTime,
        memorySpace,
        fileSystemReadOperationCount,
        fileSystemWriteOperationCount,
      } = namespace

      return {
        "user CPU time": {
          type: "duration",
          value: userCPUTime / 1000, // convert to ms
        },
        "system CPU time": {
          type: "duration",
          value: systemCPUTime / 1000, // convert to ms
        },
        "memory space": {
          type: "memory",
          value: memorySpace,
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
