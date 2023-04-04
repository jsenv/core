import { executeTestPlan, nodeWorkerThread } from "@jsenv/core"

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./tests/**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread,
      },
    },
  },
  completedExecutionLogAbbreviation: true,
  failFast: process.argv.includes("--workspace"),
})
