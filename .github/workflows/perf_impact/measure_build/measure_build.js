import { resourceUsage, memoryUsage } from "process"
import { buildProject } from "@jsenv/core"

const projectDirectoryUrl = new URL("./", import.meta.url)

// wait a bit to let Node.js cleanup things, otherwise heapUsed can be negative o_O
await new Promise((resolve) => {
  setTimeout(resolve, 500)
})

const beforeRessourceUsage = resourceUsage()
const beforeMemoryUsage = memoryUsage()
const beforeTime = Date.now()

await buildProject({
  format: "esmodule",
  projectDirectoryUrl,
  buildDirectoryRelativeUrl: "./dist/",
  entryPointMap: {
    "./main.html": "./main.min.html",
  },
  jsenvDirectoryClean: true,
  buildDirectoryClean: true,
  logLevel: "warn",
  minify: true,
})

const afterRessourceUsage = resourceUsage()
const aftertMemoryUsage = memoryUsage()
const afterTime = Date.now()

export const msEllapsed = afterTime - beforeTime

export const heapUsed = aftertMemoryUsage.heapUsed - beforeMemoryUsage.heapUsed

export const fileSystemReadOperationCount = afterRessourceUsage.fsRead - beforeRessourceUsage.fsRead

export const fileSystemWriteOperationCount =
  afterRessourceUsage.fsWrite - beforeRessourceUsage.fsWrite
