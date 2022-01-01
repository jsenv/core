import { startMeasures } from "@jsenv/performance-impact"

const measures = startMeasures({
  gc: true,
  memoryHeapUsage: true,
  filesystemUsage: true,
})

const { buildProject } = await import("@jsenv/core")
await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryRelativeUrl: "./dist/",
  format: "esmodule",
  entryPointMap: {
    "./main.html": "main.min.html",
  },
  jsenvDirectoryClean: true,
  buildDirectoryClean: true,
  logLevel: "warn",
  minify: true,
})

const {
  duration,
  heapUsed,
  fileSystemReadOperationCount,
  fileSystemWriteOperationCount,
} = measures.stop()

export const buildMetrics = {
  "build duration": { value: duration, unit: "ms" },
  "build memory heap used": { value: heapUsed, unit: "byte" },
  "number of fs read operation": { value: fileSystemReadOperationCount },
  "number of fs write operation": {
    value: fileSystemWriteOperationCount,
  },
}
