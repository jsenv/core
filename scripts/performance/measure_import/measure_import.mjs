import { startMeasures } from "@jsenv/performance-impact"

const measures = startMeasures({
  gc: true,
  memoryHeap: true,
  filesystem: true,
})
await import("../../../dist/main.js?v=1")
const { duration, memoryHeapTotal, memoryHeapUsed, fsRead } = measures.stop()

export const importMetrics = {
  "import duration": { value: duration, unit: "ms" },
  "import memory heap total": { value: memoryHeapTotal, unit: "byte" },
  "import memory heap used": { value: memoryHeapUsed, unit: "byte" },
  "import fs read operations": { value: fsRead },
}
