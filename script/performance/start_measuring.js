import { resourceUsage, memoryUsage } from "node:process"

export const startMeasuring = ({
  gc = false,
  memoryHeapUsage = false,
  filesystemUsage = false,
} = {}) => {
  if (gc) {
    global.gc()
  }
  const measures = []

  if (memoryHeapUsage) {
    const beforeHeapUsed = memoryUsage().heapUsed
    measures.push(() => {
      const afterHeapUsed = memoryUsage().heapUsed
      const heapUsed = afterHeapUsed - beforeHeapUsed
      return {
        heapUsed,
      }
    })
  }
  if (filesystemUsage) {
    const beforeRessourceUsage = resourceUsage()
    measures.push(() => {
      const afterRessourceUsage = resourceUsage()
      const fileSystemReadOperationCount =
        afterRessourceUsage.fsRead - beforeRessourceUsage.fsRead
      const fileSystemWriteOperationCount =
        afterRessourceUsage.fsWrite - beforeRessourceUsage.fsWrite
      return {
        fileSystemReadOperationCount,
        fileSystemWriteOperationCount,
      }
    })
  }
  const beforeMs = Date.now()
  measures.push(() => {
    const afterMs = Date.now()
    const msEllapsed = afterMs - beforeMs
    return {
      msEllapsed,
    }
  })

  const stop = () => {
    if (gc) {
      global.gc()
    }

    let metrics = {}
    measures.forEach((measure) => {
      metrics = {
        ...metrics,
        ...measure(),
      }
    })
    return metrics
  }

  return { stop }
}
