import { executeTestPlan, nodeWorkerThread } from "@jsenv/core"

await executeTestPlan({
  testDirectoryUrl: new URL("../tests/", import.meta.url),
  testPlan: {
    "**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread,
      },
    },
  },
  failFast: process.argv.includes("--workspace"),
})
