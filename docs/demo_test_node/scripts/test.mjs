import { executeTestPlan, nodeWorkerThread } from "@jsenv/test"

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
  },
})
