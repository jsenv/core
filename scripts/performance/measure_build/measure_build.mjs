import { startMeasures } from "@jsenv/performance-impact";

const measures = startMeasures({
  gc: true,
  memoryHeap: true,
  filesystem: true,
});
const { build } = await import("@jsenv/core");
await build({
  logs: { level: "warn" },
  sourceDirectoryUrl: import.meta.resolve("./"),
  buildDirectoryUrl: import.meta.resolve("./dist/"),
  entryPoints: {
    "./main.html": {
      buildRelativeUrl: "./main.min.html",
    },
  },
});
const { duration, memoryHeapTotal, memoryHeapUsed, fsRead, fsWrite } =
  measures.stop();

export const buildMetrics = {
  "build duration": { value: duration, unit: "ms" },
  "build memory heap used": { value: memoryHeapUsed, unit: "byte" },
  "build memory heap total": { value: memoryHeapTotal, unit: "byte" },
  "number of fs read operation": { value: fsRead },
  "number of fs write operation": { value: fsWrite },
};
