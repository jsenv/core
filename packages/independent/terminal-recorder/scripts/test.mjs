import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./**/*.test.js": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
  },
  githubCheck: false,
});
