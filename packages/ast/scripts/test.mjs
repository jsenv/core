import { executeTestPlan, nodeWorkerThread } from "@jsenv/core"

await executeTestPlan({
  testDirectoryUrl: new URL("../tests/", import.meta.url),
  testPlan: {
    "**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread,
      },
    },
    "**/with_signal_warnings.test.mjs": {
      node: {
        runtime: nodeWorkerThread,
        runtimeParams: {
          commandLineOptions: ["--no-warnings"],
        },
      },
    },
  },
  failFast: process.argv.includes("--workspace"),
  completedExecutionLogMerging: process.argv.includes("--workspace"),
  coverageEnabled: process.argv.includes("--coverage"),
})
