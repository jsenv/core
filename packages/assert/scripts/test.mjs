import {
  executeTestPlan,
  chromium,
  firefox,
  webkit,
  nodeWorkerThread,
} from "@jsenv/core"

await executeTestPlan({
  testDirectoryUrl: new URL("../src/", import.meta.url),
  testPlan: {
    "**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread,
      },
    },
    "**/*.test.html": {
      chromium: {
        runtime: chromium,
        allocatedMs: 90_000,
      },
      firefox: {
        runtime: firefox,
        allocatedMs: 90_000,
      },
      webkit: {
        runtime: webkit,
        allocatedMs: 90_000,
      },
    },
  },
  devServerOrigin: "http://localhost:3457",
  devServerModuleUrl: new URL("./start_dev_server.mjs", import.meta.url),
  failFast: process.argv.includes("--workspace"),
  completedExecutionLogMerging: process.argv.includes("--workspace"),
})
