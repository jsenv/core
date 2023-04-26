import { executeTestPlan, nodeWorkerThread } from "@jsenv/test"

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./tests/**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread(),
        allocatedMs: ({ fileRelativeUrl }) => {
          if (
            fileRelativeUrl.endsWith("coverage_browsers_and_node.test.mjs") ||
            fileRelativeUrl.endsWith("_browsers.test.mjs")
          ) {
            return 60_000
          }
          return 30_000
        },
      },
    },
  },
  completedExecutionLogAbbreviation: true,
  failFast: process.argv.includes("--workspace"),
  completedExecutionLogMerging: process.argv.includes("--workspace"),
  coverageEnabled: process.argv.includes("--coverage"),
})
