import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./tests/**/*.test.js": {
      node: {
        runtime: nodeWorkerThread(),
        allocatedMs: 180_000, // generating svgs takes a lot of time
      },
    },
  },
  githubCheck: false,
});
