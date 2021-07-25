import { resourceUsage, memoryUsage } from "process"

// wait a bit to let Node.js cleanup things, otherwise heapUsed can be negative o_O
await new Promise((resolve) => {
  setTimeout(resolve, 1000)
})

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
