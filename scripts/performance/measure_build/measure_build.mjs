import { startMeasures } from "@jsenv/performance-impact"

const measures = startMeasures({
  gc: true,
  memoryHeap: true,
  filesystem: true,
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

const { duration, memoryHeapTotal, memoryHeapUsed, fsRead, fsWrite } =
  measures.stop()

export const buildMetrics = {
  "build duration": { value: duration, unit: "ms" },
  "build memory heap total": { value: memoryHeapTotal, unit: "byte" },
  "build memory heap used": { value: memoryHeapUsed, unit: "byte" },
  "number of fs read operation": { value: fsRead },
  "number of fs write operation": { value: fsWrite },
}
