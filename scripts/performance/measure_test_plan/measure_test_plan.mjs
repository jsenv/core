import { startMeasures } from "@jsenv/performance-impact";

const measures = startMeasures({
  gc: true,
  memoryHeap: true,
  filesystem: true,
});

const { startDevServer } = await import("@jsenv/core");
const { executeTestPlan, chromium, firefox, webkit, nodeWorkerThread } =
  await import("@jsenv/test");

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./", import.meta.url),
  keepProcessAlive: false,
});

await executeTestPlan({
  webServer: {
    origin: devServer.origin,
  },
  rootDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./animals.test.html": {
      chromium: {
        runtime: chromium(),
        captureConsole: false,
      },
      firefox: {
        runtime: firefox({
          disableOnWindowsBecauseFlaky: true,
        }),
        captureConsole: false,
      },
      webkit: {
        runtime: webkit(),
        captureConsole: false,
      },
    },
    "./animals.test.js": {
      node: {
        runtime: nodeWorkerThread(),
        captureConsole: false,
      },
    },
  },
  parallel: !process.env.SERIE,
  logs: {
    level: "warn",
  },
  coverage: {
    include: {
      "./animals.js": true,
    },
    methodForNodeJs: "Profiler",
    v8ConflictWarning: false,
  },
  githubCheck: false,
});

const { duration, memoryHeapUsed, memoryHeapTotal, fsRead, fsWrite } =
  measures.stop();

export const testPlanMetrics = {
  "test plan duration": { value: duration, unit: "ms" },
  "test plan memory heap used": { value: memoryHeapUsed, unit: "byte" },
  "test plan memory heap total": { value: memoryHeapTotal, unit: "byte" },
  "number of fs read operation": { value: fsRead },
  "number of fs write operation": { value: fsWrite },
};
