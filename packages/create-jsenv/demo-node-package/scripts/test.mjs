/*
 * Execute all test files
 * - npm test
 * - npm test:coverage
 */

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
  coverageEnabled: process.argv.includes("--coverage"),
  coverageMethodForNodeJs: "Profiler",
});
