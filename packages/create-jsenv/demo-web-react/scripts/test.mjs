/*
 * Execute all test files
 * - npm test
 * - npm test:coverage
 */

import { executeTestPlan, chromium, webkit } from "@jsenv/core"

await executeTestPlan({
  testDirectoryUrl: new URL("../src/", import.meta.url),
  devServerOrigin: "http://localhost:3401",
  devServerModuleUrl: new URL("./start_dev_server.mjs", import.meta.url),
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
  coverageEnabled: process.argv.includes("--coverage"),
  coverageMethodForBrowsers: "istanbul",
})
