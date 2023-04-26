/*
 * Execute all test files
 * - npm test
 * - npm test:coverage
 * Read more in https://github.com/jsenv/core/tree/main/packages/test#jsenvtest-
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
