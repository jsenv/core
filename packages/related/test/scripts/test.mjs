import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./tests/**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread(),
        allocatedMs: ({ fileRelativeUrl }) => {
          if (fileRelativeUrl.endsWith("coverage_browsers_and_node.test.mjs")) {
            return 60_000;
          }
          if (fileRelativeUrl.endsWith("browser_tabs.test.mjs")) {
            return 60_000;
          }
          if (fileRelativeUrl.endsWith("test_plan_logs_browsers.test.mjs")) {
            return 160_000;
          }
          if (fileRelativeUrl.endsWith("_browsers.test.mjs")) {
            return 90_000;
          }
          return 30_000;
        },
      },
    },
  },
});
