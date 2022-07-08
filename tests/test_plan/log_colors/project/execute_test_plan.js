import { executeTestPlan, nodeChildProcess } from "@jsenv/core"

await executeTestPlan({
  logLevel: "info",
  logEachDuration: false,
  logSummary: false,
  rootDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./file.js": {
      node: {
        runtime: nodeChildProcess,
        collectConsole: false,
      },
    },
  },
})
