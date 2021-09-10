import { resourceUsage, memoryUsage } from "process"
import { buildProject } from "@jsenv/core"

const buildProjectParameters = {
  format: "esmodule",
  projectDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryRelativeUrl: "./dist/",
  entryPointMap: {
    "./main.html": "./main.min.html",
  },
  jsenvDirectoryClean: true,
  buildDirectoryClean: true,
  logLevel: "warn",
  minify: true,
}

global.gc()
const beforeHeapUsed = memoryUsage().heapUsed
const beforeRessourceUsage = resourceUsage()
const beforeMs = Date.now()

await buildProject(buildProjectParameters)

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
