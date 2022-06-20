import { startMeasures } from "@jsenv/performance-impact"

const measures = startMeasures({
  gc: true,
  memoryHeapUsage: true,
})

await import("jsenv-demo-node-package")

const { duration, heapUsed } = measures.stop()

export const packageImportMetrics = {
  "import duration": { value: duration, unit: "ms" },
  "import memory heap used": { value: Math.max(heapUsed, 0), unit: "byte" },
}
