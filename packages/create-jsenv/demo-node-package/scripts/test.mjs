/*
 * Execute all test files
 * - npm test
 * - npm test:coverage
 */

import { executeTestPlan, nodeProcess } from "@jsenv/core"

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "tests/**/*.test.mjs": {
      node: {
        runtime: nodeProcess,
      },
    },
  },
  coverage: process.argv.includes("--coverage"),
})
