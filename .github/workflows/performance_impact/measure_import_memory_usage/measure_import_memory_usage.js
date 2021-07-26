import { fork } from "child_process"
import { fileURLToPath } from "url"
import { measurePerformanceMultipleTimes, computeMetricsMedian } from "@jsenv/performance-impact"

export const measureImportMemoryUsage = async () => {
  const childProcessFileUrl = new URL("./child_process_measuring_memory.js", import.meta.url)
  const childProcessFilePath = fileURLToPath(childProcessFileUrl)

  const metrics = await measurePerformanceMultipleTimes(
    async () => {
      const childProcess = fork(childProcessFilePath, {
        execArgv: ["--expose-gc"],
      })
      const { heapUsed } = await new Promise((resolve) => {
        childProcess.on("message", (message) => {
          resolve(message)
        })
      })

      return {
        "import memory heap used": { value: heapUsed, unit: "byte" },
      }
    },
    10,
    { msToWaitBetweenEachMeasure: 50 },
  )
  return computeMetricsMedian(metrics)
}
