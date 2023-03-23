import { executeTestPlan, nodeWorkerThread } from "@jsenv/core"

await executeTestPlan({
  logLevel: "info",
  logEachDuration: false,
  logSummary: false,
  testDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./file.js": {
      node: {
        runtime: nodeWorkerThread,
        collectConsole: false,
      },
    },
  },
})
