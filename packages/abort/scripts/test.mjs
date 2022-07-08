import { executeTestPlan, nodeChildProcess } from "@jsenv/core"

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "tests/**/*.test.mjs": {
      node: {
        runtime: nodeChildProcess,
      },
    },
    "tests/**/with_signal_warnings.test.mjs": {
      node: {
        runtime: nodeChildProcess,
        runtimeParams: {
          commandLineOptions: ["--no-warnings"],
        },
      },
    },
  },
  failFast: process.argv.includes("--workspace"),
  completedExecutionLogMerging: process.argv.includes("--workspace"),
  coverage: process.argv.includes("--coverage"),
})
