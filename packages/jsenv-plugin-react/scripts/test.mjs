import { executeTestPlan, nodeWorkerThread } from "@jsenv/core"

await executeTestPlan({
  testDirectoryUrl: new URL("../tests/", import.meta.url),
  testPlan: {
    "**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread,
        allocatedMs: 90_000,
      },
    },
  },
  failFast: process.argv.includes("--workspace"),
  completedExecutionLogMerging: process.argv.includes("--workspace"),
  coverageEnabled: process.argv.includes("--coverage"),
})
