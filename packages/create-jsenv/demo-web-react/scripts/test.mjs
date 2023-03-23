/*
 * Execute all test files
 * - npm test
 * - npm test:coverage
 */

import { executeTestPlan, chromium, webkit } from "@jsenv/core"

await executeTestPlan({
  testDirectoryUrl: new URL("../src/", import.meta.url),
  testPlan: {
    "./**/*.test.html": {
      chromium: {
        runtime: chromium,
      },
      webkit: {
        runtime: webkit,
      },
    },
  },
  devServerOrigin: "http://localhost:3401",
  devServerModuleUrl: new URL("./dev.mjs", import.meta.url),
  coverageEnabled: process.argv.includes("--coverage"),
  coverageMethodForBrowsers: "istanbul",
})
