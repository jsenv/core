/*
 * Execute all test files
 * - npm test
 * - npm test:coverage
 */

import { executeTestPlan, chromium, firefox } from "@jsenv/core"

import { rootDirectoryUrl } from "../jsenv.config.mjs"

await executeTestPlan({
  rootDirectoryUrl,
  testPlan: {
    "./tests/**/*.test.html": {
      chromium: {
        runtime: chromium,
      },
      firefox: {
        runtime: firefox,
      },
    },
  },
  coverageEnabled: process.argv.includes("--coverage"),
  coverageMethodForBrowsers: "istanbul",
})
