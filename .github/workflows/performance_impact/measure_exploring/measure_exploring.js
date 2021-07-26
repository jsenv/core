import { fork } from "child_process"
import { fileURLToPath } from "url"
import { measurePerformanceMultipleTimes, computeMetricsMedian } from "@jsenv/performance-impact"

export const measureExploring = async () => {
  const childProcessFileUrl = new URL("./child_process_measuring_exploring.js", import.meta.url)
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
        "start exploring duration": { value: msEllapsed, unit: "ms" },
        "start exploring memory heap used": { value: heapUsed, unit: "byte" },
        "number of fs read operation": { value: fileSystemReadOperationCount },
        "number of fs write operation": { value: fileSystemWriteOperationCount },
      }
    },
    10,
    { msToWaitBetweenEachMeasure: 50 },
  )
  return computeMetricsMedian(metrics)
}
