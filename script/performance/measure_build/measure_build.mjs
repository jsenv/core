import { startMeasures } from "@jsenv/performance-impact"

const measures = startMeasures({
  gc: true,
  memoryHeapUsage: true,
  filesystemUsage: true,
})

const { build } = await import("@jsenv/core")
await build({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  buildDirectoryClean: true,
  entryPoints: {
    "./main.html": "main.min.html",
  },
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
