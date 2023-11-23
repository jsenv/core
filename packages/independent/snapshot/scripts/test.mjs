import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./tests/**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
  },
  concurrency: true,
  logShortForCompletedExecutions: true,
  logMergeForCompletedExecutions: process.argv.includes("--workspace"),
  githubCheckEnabled: false,
});
