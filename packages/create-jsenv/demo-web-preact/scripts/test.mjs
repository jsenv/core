/*
 * Execute all test files
 * - npm test
 * - npm test:coverage
 */

import { executeTestPlan, chromium } from "@jsenv/core";

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.html": {
      chromium: {
        runtime: chromium,
      },
    },
  },
  webServer: {
    origin: "http://localhost:3401",
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
  coverageEnabled: process.argv.includes("--coverage"),
});
