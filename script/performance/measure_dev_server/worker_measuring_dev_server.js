/* eslint-disable no-unused-vars */
import { parentPort } from "node:worker_threads"
import { resourceUsage, memoryUsage } from "node:process"

global.gc()
const beforeHeapUsed = memoryUsage().heapUsed
const beforeRessourceUsage = resourceUsage()
const beforeMs = Date.now()

const { startExploring } = await import("@jsenv/core")
await startExploring({
  projectDirectoryUrl: new URL("./", import.meta.url),
  compileServerLogLevel: "warn",
  compileServerProtocol: "http",
  keepProcessAlive: false,
})

global.gc()
const afterMs = Date.now()
const afterHeapUsed = memoryUsage().heapUsed
const afterRessourceUsage = resourceUsage()

const msEllapsed = afterMs - beforeMs
const heapUsed = afterHeapUsed - beforeHeapUsed
const fileSystemReadOperationCount =
  afterRessourceUsage.fsRead - beforeRessourceUsage.fsRead
const fileSystemWriteOperationCount =
  afterRessourceUsage.fsWrite - beforeRessourceUsage.fsWrite
parentPort.postMessage({
  heapUsed,
  msEllapsed,
  fileSystemReadOperationCount,
  fileSystemWriteOperationCount,
})
