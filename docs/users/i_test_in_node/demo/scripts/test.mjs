import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: import.meta.resolve("../"),
  testPlan: {
    "./src/**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
  },
});
