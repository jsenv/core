import { resourceUsage, memoryUsage } from "process"
import { startExploring } from "@jsenv/core"

const projectDirectoryUrl = new URL("./", import.meta.url)

const beforeImportRessourceUsage = resourceUsage()
const beforeImportMemoryUsage = memoryUsage()
const beforeImportTime = Date.now()

await startExploring({
  projectDirectoryUrl,
  compileServerProtocol: "https",
})

const afterImportRessourceUsage = resourceUsage()
const afterImportMemoryUsage = memoryUsage()
const afterImportTime = Date.now()

export const msEllapsed = afterImportTime - beforeImportTime

export const heapUsed = afterImportMemoryUsage.heapUsed - beforeImportMemoryUsage.heapUsed

export const fileSystemReadOperationCount =
  afterImportRessourceUsage.fsRead - beforeImportRessourceUsage.fsRead

export const fileSystemWriteOperationCount =
  afterImportRessourceUsage.fsWrite - beforeImportRessourceUsage.fsWrite
