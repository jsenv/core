/*
 * Execute all test files
 * - npm test
 * - npm test:coverage
 * Read more in https://github.com/jsenv/core/tree/main/packages/test#jsenvtest-
 */

import { executeTestPlan, chromium } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.html": {
      chromium: {
        runtime: chromium(),
      },
    },
  },
  webServer: {
    origin: "http://localhost:3402",
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
  coverageEnabled: process.argv.includes("--coverage"),
});
