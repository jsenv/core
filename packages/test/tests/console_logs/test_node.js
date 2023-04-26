import { executeTestPlan, nodeWorkerThread } from "@jsenv/test"

await executeTestPlan({
  logLevel: "info",
  logRuntime: false,
  logEachDuration: false,
  logSummary: false,
  rootDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./client/main.js": {
      node: {
        runtime: nodeWorkerThread,
        collectConsole: true,
      },
    },
  },
})
