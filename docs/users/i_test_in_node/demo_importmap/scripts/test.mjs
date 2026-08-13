import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: import.meta.resolve("../"),
  testPlan: {
    "./src/**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread({
          importmap: {
            imports: {
              "./src/sum.mjs": "./src/sum_mock.mjs",
            },
          },
        }),
      },
    },
  },
});
