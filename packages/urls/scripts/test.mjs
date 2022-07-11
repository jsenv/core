import { executeTestPlan, nodeChildProcess } from "@jsenv/core"

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "tests/**/*.test.mjs": {
      node: {
        runtime: nodeChildProcess,
      },
    },
  },
  failFast: process.argv.includes("--workspace"),
  completedExecutionLogMerging: process.argv.includes("--workspace"),
  coverageEnabled: process.argv.includes("--coverage"),
})
