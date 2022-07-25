/*
 * Execute all test files
 * - npm test
 * - npm test:coverage
 */

import { executeTestPlan, chromium, webkit } from "@jsenv/core"

import { rootDirectoryUrl } from "../jsenv.config.mjs"

await executeTestPlan({
  rootDirectoryUrl,
  testPlan: {
    "./tests/**/*.test.html": {
      chromium: {
        runtime: chromium,
      },
      webkit: {
        runtime: webkit,
      },
    },
  },
  coverageEnabled: process.argv.includes("--coverage"),
  coverageMethodForBrowsers: "istanbul",
})
