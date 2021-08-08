import { fork } from "child_process"
import { fileURLToPath } from "url"

import {
  measurePerformanceMultipleTimes,
  computeMetricsMedian,
  logPerformanceMetrics,
} from "@jsenv/performance-impact"

export const measureBuild = async ({ iterations = 10 } = {}) => {
  const childProcessFileUrl = new URL("./child_process_measuring_build.js", import.meta.url)
  const childProcessFilePath = fileURLToPath(childProcessFileUrl)

  const metrics = await measurePerformanceMultipleTimes(
    async () => {
      const childProcess = fork(childProcessFilePath, {
        execArgv: ["--expose-gc"],
      })
      const { heapUsed, msEllapsed, fileSystemReadOperationCount, fileSystemWriteOperationCount } =
        await new Promise((resolve) => {
          childProcess.on("message", (message) => {
            resolve(message)
          })
        })

      return {
        "build duration": { value: msEllapsed, unit: "ms" },
        "build memory heap used": { value: heapUsed, unit: "byte" },
        "number of fs read operation": { value: fileSystemReadOperationCount },
        "number of fs write operation": { value: fileSystemWriteOperationCount },
      }
    },
    iterations,
    { msToWaitBetweenEachMeasure: 50 },
  )
  return computeMetricsMedian(metrics)
}

const executeAndLog = process.argv.includes("--log")
if (executeAndLog) {
  const performanceMetrics = await measureBuild({ iterations: 1 })
  logPerformanceMetrics(performanceMetrics)
}
