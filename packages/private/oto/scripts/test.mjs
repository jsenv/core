/*
 * Execute all test files
 * Read more in https://github.com/jsenv/core
 */

import { chromium, executeTestPlan, nodeWorkerThread } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: import.meta.resolve("../"),
  testPlan: {
    "./**/*.test.html": {
      chromium: {
        runtime: chromium(),
      },
    },
    "./**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
  },
  webServer: {
    origin: "http://localhost:3400",
    moduleUrl: import.meta.resolve("./dev.mjs"),
  },
  coverage: process.argv.includes("--coverage"),
  githubCheck: false,
});
