import { executeTestPlan, chromium } from "@jsenv/core"

await executeTestPlan({
  logLevel: "info",
  logRuntime: false,
  logEachDuration: false,
  logSummary: false,
  rootDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./client/main.html": {
      chrome: {
        runtime: chromium,
        collectConsole: true,
      },
    },
  },
})
