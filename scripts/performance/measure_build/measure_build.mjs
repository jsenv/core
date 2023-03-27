import { startMeasures } from "@jsenv/performance-impact"

const measures = startMeasures({
  gc: true,
  memoryHeap: true,
  filesystem: true,
})
const { build } = await import("@jsenv/core")
const { jsenvPluginMinification } = await import("@jsenv/plugin-minification")
const { jsenvPluginBundling } = await import("@jsenv/plugin-bundling")
await build({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./", import.meta.url),
  entryPoints: {
    "./main.html": "main.min.html",
  },
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  plugins: [jsenvPluginMinification(), jsenvPluginBundling()],
})
const { duration, memoryHeapTotal, memoryHeapUsed, fsRead, fsWrite } =
  measures.stop()

export const buildMetrics = {
  "build duration": { value: duration, unit: "ms" },
  "build memory heap used": { value: memoryHeapUsed, unit: "byte" },
  "build memory heap total": { value: memoryHeapTotal, unit: "byte" },
  "number of fs read operation": { value: fsRead },
  "number of fs write operation": { value: fsWrite },
}
