/*
 * Execute all test files
 * - npm test
 * - npm test:coverage
 */

import { executeTestPlan, chromium } from "@jsenv/core"

await executeTestPlan({
  testDirectoryUrl: new URL("../src/", import.meta.url),
  testPlan: {
    "./**/*.test.html": {
      firefox: {
        runtime: chromium,
      },
    },
  },
  devServerOrigin: "http://localhost:3400",
  devServerModuleUrl: new URL("./dev.mjs", import.meta.url),
  coverageEnabled: process.argv.includes("--coverage"),
  coverageMethodForBrowsers: "istanbul",
})
