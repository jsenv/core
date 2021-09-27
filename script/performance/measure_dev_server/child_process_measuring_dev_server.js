/* eslint-disable no-unused-vars */
import { resourceUsage, memoryUsage } from "node:process"
import { startExploring } from "@jsenv/core"

const startExploringParams = {
  projectDirectoryUrl: new URL("./", import.meta.url),
  compileServerLogLevel: "warn",
  compileServerProtocol: "http",
  keepProcessAlive: false,
}

global.gc()
const beforeHeapUsed = memoryUsage().heapUsed
const beforeRessourceUsage = resourceUsage()
const beforeMs = Date.now()

await startExploring(startExploringParams)

const afterMs = Date.now()
const afterHeapUsed = memoryUsage().heapUsed
const afterRessourceUsage = resourceUsage()

const msEllapsed = afterMs - beforeMs
const heapUsed = afterHeapUsed - beforeHeapUsed
const fileSystemReadOperationCount =
  afterRessourceUsage.fsRead - beforeRessourceUsage.fsRead
const fileSystemWriteOperationCount =
  afterRessourceUsage.fsWrite - beforeRessourceUsage.fsWrite
process.send({
  heapUsed,
  msEllapsed,
  fileSystemReadOperationCount,
  fileSystemWriteOperationCount,
})
