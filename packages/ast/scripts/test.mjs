import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./tests/**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
    "./tests/**/with_signal_warnings.test.mjs": {
      node: {
        runtime: nodeWorkerThread({
          commandLineOptions: ["--no-warnings"],
        }),
      },
    },
  },
  failFast: process.argv.includes("--workspace"),
  logShortForCompletedExecutions: true,
  logMergeForCompletedExecutions: process.argv.includes("--workspace"),
});
