import { fork } from "child_process"
import { fileURLToPath } from "url"
import { measurePerformanceMultipleTimes, computeMetricsMedian } from "@jsenv/performance-impact"

export const measureImport = async () => {
  const childProcessFileUrl = new URL("./child_process_measuring_import.js", import.meta.url)
  const childProcessFilePath = fileURLToPath(childProcessFileUrl)

  const metrics = await measurePerformanceMultipleTimes(
    async () => {
      const childProcess = fork(childProcessFilePath)
      const { msEllapsed, heapUsed } = await new Promise((resolve) => {
        childProcess.on("message", (message) => {
          resolve(message)
        })
      })

      return {
        "import duration": { value: msEllapsed, unit: "ms" },
        "import memory heap used": { value: heapUsed, unit: "byte" },
      }
    },
    10,
    { msToWaitBetweenEachMeasure: 50 },
  )
  return computeMetricsMedian(metrics)
}
