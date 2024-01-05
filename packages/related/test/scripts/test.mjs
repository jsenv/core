import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./tests/**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
    "./tests/**/coverage_browsers_and_node.test.mjs": {
      node: {
        allocatedMs: 60_000,
      },
    },
    "./tests/**/browser_tabs.test.mjs": {
      node: {
        allocatedMs: 60_000,
      },
    },
    "./tests/**/*_browsers.test.mjs": {
      node: {
        allocatedMs: 90_000,
      },
    },
  },
  githubCheck: false,
});
