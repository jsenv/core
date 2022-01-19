import { executeTestPlan, nodeRuntime } from "@jsenv/core"

await executeTestPlan({
  projectDirectoryUrl: new URL("../../", import.meta.url),
  testPlan: {
    "test/**/*.test.js": {
      node: {
        runtime: nodeRuntime,
      },
    },
  },
  completedExecutionLogMerging: true,
})
