import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./tests/**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread({
          importMap: {
            imports: {
              "./src/sum.mjs": "./src/sum_mock.mjs",
            },
          },
        }),
      },
    },
  },
});
