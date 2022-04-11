import { executeTestPlan, nodeProcess } from "@jsenv/core"

await executeTestPlan({
  rootDirectoryUrl: new URL("../../", import.meta.url),
  testPlan: {
    "test/**/*.test.js": {
      node: {
        runtime: nodeProcess,
      },
    },
  },
  completedExecutionLogMerging: true,
  coverage: process.argv.includes("--coverage"),
})
