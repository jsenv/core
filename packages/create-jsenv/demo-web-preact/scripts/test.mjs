/*
 * Execute all test files
 * - npm test
 * - npm test:coverage
 */

import { executeTestPlan, chromium, firefox } from "@jsenv/core"

import { rootDirectoryUrl, plugins } from "../jsenv.config.mjs"

await executeTestPlan({
  rootDirectoryUrl,
  plugins,
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
