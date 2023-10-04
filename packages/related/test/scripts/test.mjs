import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./tests/**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread(),
        allocatedMs: ({ fileRelativeUrl }) => {
          if (
            fileRelativeUrl.endsWith("coverage_browsers_and_node.test.mjs") ||
            fileRelativeUrl.endsWith("_browsers.test.mjs") ||
            fileRelativeUrl.endsWith("browser_tabs.test.mjs")
          ) {
            return 60_000;
          }
          return 30_000;
        },
      },
    },
  },
  failFast: process.argv.includes("--workspace"),
  logShortForCompletedExecutions: true,
  logMergeForCompletedExecutions: process.argv.includes("--workspace"),
});
