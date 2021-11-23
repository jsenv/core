import { startMeasures } from "@jsenv/performance-impact"

const measures = startMeasures({
  gc: true,
  memoryHeapUsage: true,
  filesystemUsage: true,
})

const {
  executeTestPlan,
  chromiumRuntime,
  firefoxRuntime,
  webkitRuntime,
  nodeRuntime,
} = await import("@jsenv/core")

const projectDirectoryUrl = new URL("../../../", import.meta.url)
const currentDirectoryUrl = new URL("./", import.meta.url)
const currentDirectoryRelativeUrl = new URL(
  currentDirectoryUrl,
  projectDirectoryUrl,
)
await executeTestPlan({
  projectDirectoryUrl,
  testPlan: {
    [`${currentDirectoryRelativeUrl}animals.test.html`]: {
      chromium: {
        runtime: chromiumRuntime,
        captureConsole: false,
      },
      firefox: {
        runtime: firefoxRuntime,
        captureConsole: false,
      },
      webkit: {
        runtime: webkitRuntime,
        captureConsole: false,
      },
    },
    [`${currentDirectoryRelativeUrl}animals.test.js`]: {
      node: {
        runtime: nodeRuntime,
        captureConsole: false,
      },
    },
  },
  logLevel: "warn",
  protocol: "http",
  coverage: true,
  coverageConfig: {
    [`${currentDirectoryRelativeUrl}animals.js`]: true,
  },
  coverageV8ConflictWarning: false,
  coverageHtmlDirectory: false,
  coverageTextLog: false,
  // here we should also clean jsenv directory to ensure
  // the compile server cannot reuse cache
  // to mitigate this compileServerCanReadFromFilesystem and compileServerCanWriteOnFilesystem
  // are false for now
  compileServerCanReadFromFilesystem: false,
  compileServerCanWriteOnFilesystem: false,
})

const {
  duration,
  heapUsed,
  fileSystemReadOperationCount,
  fileSystemWriteOperationCount,
} = measures.stop()

export const testPlanMetrics = {
  "test plan duration": { value: duration, unit: "ms" },
  "test plan memory heap used": { value: heapUsed, unit: "byte" },
  "number of fs read operation": { value: fileSystemReadOperationCount },
  "number of fs write operation": {
    value: fileSystemWriteOperationCount,
  },
}
