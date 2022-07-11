/*
 * Execute all test files
 * - npm test
 * - npm test:coverage
 */

import { executeTestPlan, nodeChildProcess } from "@jsenv/core"

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "tests/**/*.test.mjs": {
      node: {
        runtime: nodeChildProcess,
      },
    },
  },
  coverageEnabled: process.argv.includes("--coverage"),
})
