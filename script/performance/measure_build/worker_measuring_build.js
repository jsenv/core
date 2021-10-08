import { parentPort } from "node:worker_threads"
import { resourceUsage, memoryUsage } from "node:process"

global.gc()
const beforeHeapUsed = memoryUsage().heapUsed
const beforeRessourceUsage = resourceUsage()
const beforeMs = Date.now()

const { buildProject } = await import("@jsenv/core")
await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryRelativeUrl: "./dist/",
  format: "esmodule",
  entryPointMap: {
    "./main.html": "./main.min.html",
  },
  jsenvDirectoryClean: true,
  buildDirectoryClean: true,
  logLevel: "warn",
  minify: true,
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
