import { resourceUsage, memoryUsage } from "process"

const beforeImportRessourceUsage = resourceUsage()
const beforeImportMemoryUsage = memoryUsage()
const beforeImportTime = Date.now()

await import(`@jsenv/core`)

const afterImportRessourceUsage = resourceUsage()
const afterImportMemoryUsage = memoryUsage()
const afterImportTime = Date.now()

export const msEllapsed = afterImportTime - beforeImportTime

export const heapUsed = afterImportMemoryUsage.heapUsed - beforeImportMemoryUsage.heapUsed

export const fileSystemReadOperationCount =
  afterImportRessourceUsage.fsRead - beforeImportRessourceUsage.fsRead

export const fileSystemWriteOperationCount =
  afterImportRessourceUsage.fsWrite - beforeImportRessourceUsage.fsWrite
