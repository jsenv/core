import { resourceUsage, memoryUsage } from "process"

const beforeImportRessourceUsage = resourceUsage()
const beforeImportMemoryUsage = memoryUsage()

await import(`@jsenv/core`)

const afterImportRessourceUsage = resourceUsage()
const afterImportMemoryUsage = memoryUsage()

export const userCPUTime =
  afterImportRessourceUsage.userCPUTime - beforeImportRessourceUsage.userCPUTime

export const heapUsed = afterImportMemoryUsage.heapUsed - beforeImportMemoryUsage.heapUsed

export const fileSystemReadOperationCount =
  afterImportRessourceUsage.fsRead - beforeImportRessourceUsage.fsRead

export const fileSystemWriteOperationCount =
  afterImportRessourceUsage.fsWrite - beforeImportRessourceUsage.fsWrite
