import { Worker } from "node:worker_threads"
import { fileURLToPath } from "node:url"
import {
  measurePerformanceMultipleTimes,
  computeMetricsMedian,
  logPerformanceMetrics,
} from "@jsenv/performance-impact"

export const measureDevServer = async ({ iterations = 10 } = {}) => {
  const workerFileUrl = new URL(
    "./worker_measuring_dev_server.js",
    import.meta.url,
  )
  const workerFilePath = fileURLToPath(workerFileUrl)

  const metrics = await measurePerformanceMultipleTimes(
    async () => {
      const worker = new Worker(workerFilePath)
      const {
        timeToStartDevServer,
        timeToDisplayAppUsingSourceFiles,
        timeToDisplayAppUsingCompiledFiles,
        timeToDisplayAppCompiledAndSecondVisit,
      } = await new Promise((resolve, reject) => {
        worker.on("message", resolve)
        worker.on("error", reject)
      })

      return {
        "time to start dev server": { value: timeToStartDevServer, unit: "ms" },
        "time to display app using source files": {
          value: timeToDisplayAppUsingSourceFiles,
          unit: "ms",
        },
        "time to display app using compiled files": {
          value: timeToDisplayAppUsingCompiledFiles,
          unit: "ms",
        },
        "time to display app compiled and second visit": {
          value: timeToDisplayAppCompiledAndSecondVisit,
          unit: "ms",
        },
      }
    },
    iterations,
    { msToWaitBetweenEachMeasure: 100 },
  )
  return computeMetricsMedian(metrics)
}

const executeAndLog = process.argv.includes("--local")
if (executeAndLog) {
  const performanceMetrics = await measureDevServer({ iterations: 1 })
  logPerformanceMetrics(performanceMetrics)
}
