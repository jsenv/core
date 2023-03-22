import { executeTestPlan, nodeWorkerThread } from "@jsenv/core"

await executeTestPlan({
  sourceDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "tests/**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread,
      },
    },
  },
  failFast: process.argv.includes("--workspace"),
  completedExecutionLogMerging: process.argv.includes("--workspace"),
  coverageEnabled: process.argv.includes("--coverage"),
})
