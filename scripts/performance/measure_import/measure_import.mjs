import { startMeasures } from "@jsenv/performance-impact";

const measures = startMeasures({
  gc: true,
  memoryHeap: true,
  filesystem: true,
});
await import("../../../dist/jsenv_core.js?v=1");
const { duration, memoryHeapTotal, memoryHeapUsed, fsStatCall, fsOpenCall } =
  measures.stop();

export const importMetrics = {
  "import duration": { value: duration, unit: "ms" },
  "import memory heap used": { value: memoryHeapUsed, unit: "byte" },
  "import memory heap total": { value: memoryHeapTotal, unit: "byte" },
  "import fs stat operations": { value: fsStatCall },
  "import fs open operations": { value: fsOpenCall },
};
