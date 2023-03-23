/*
 * Execute all test files
 * - npm test
 * - npm test:coverage
 */

import { executeTestPlan, nodeWorkerThread } from "@jsenv/core"

await executeTestPlan({
  testDirectoryUrl: new URL("../tests/", import.meta.url),
  testPlan: {
    "**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread,
      },
    },
  },
  coverageEnabled: process.argv.includes("--coverage"),
  coverageMethodForNodeJs: "Profiler",
})
