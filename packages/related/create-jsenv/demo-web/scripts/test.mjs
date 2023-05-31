/*
 * Execute all test files
 * - npm test
 * - npm test:coverage
 * Read more in https://github.com/jsenv/core/wiki/D)-Test
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
    origin: "http://localhost:3400",
    rootDirectoryUrl: new URL("../src/", import.meta.url),
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
  coverageEnabled: process.argv.includes("--coverage"),
});
