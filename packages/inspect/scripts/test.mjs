import {
  executeTestPlan,
  chromium,
  firefox,
  webkit,
  nodeWorkerThread,
} from "@jsenv/core"

await executeTestPlan({
  testDirectoryUrl: new URL("../src/", import.meta.url),
  devServerOrigin: "http://localhost:3456",
  devServerModuleUrl: new URL("./dev.mjs", import.meta.url),
  testPlan: {
    "**/*.test.js": {
      node: {
        runtime: nodeWorkerThread,
      },
    },
    "**/*.test.html": {
      chromium: {
        runtime: chromium,
      },
      firefox: {
        runtime: firefox,
        allocatedMs: process.platform === "win32" ? 60_000 : 30_000,
      },
      webkit: {
        runtime: webkit,
      },
    },
  },
  failFast: process.argv.includes("--workspace"),
  completedExecutionLogMerging: process.argv.includes("--workspace"),
})
