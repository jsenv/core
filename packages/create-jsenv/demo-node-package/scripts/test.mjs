/*
 * Execute all test files
 * - npm test
 * - npm test:coverage
 */

import { executeTestPlan, nodeWorkerThread } from "@jsenv/core"

await executeTestPlan({
  sourceDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "tests/**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread,
      },
    },
  },
  coverageEnabled: process.argv.includes("--coverage"),
  coverageMethodForNodeJs: "Profiler",
})
