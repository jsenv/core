import { Worker } from "node:worker_threads"
import { fileURLToPath } from "node:url"
import {
  measurePerformanceMultipleTimes,
  computeMetricsMedian,
  logPerformanceMetrics,
} from "@jsenv/performance-impact"

export const measureDevServer = async ({ iterations = 10 } = {}) => {
  if (!global.gc) {
    throw new Error("missing --expose-gc")
  }
  const workerFileUrl = new URL(
    "./worker_measuring_dev_server.js",
    import.meta.url,
  )
  const workerFilePath = fileURLToPath(workerFileUrl)

  const metrics = await measurePerformanceMultipleTimes(
    async () => {
      const worker = new Worker(workerFilePath)
      const {
        heapUsed,
        msEllapsed,
        fileSystemReadOperationCount,
        fileSystemWriteOperationCount,
      } = await new Promise((resolve, reject) => {
        worker.on("message", resolve)
        worker.on("error", reject)
      })

      return {
        "start duration": { value: msEllapsed, unit: "ms" },
        "dev server memory heap used": { value: heapUsed, unit: "byte" },
        "number of fs read operation": { value: fileSystemReadOperationCount },
        "number of fs write operation": {
          value: fileSystemWriteOperationCount,
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
