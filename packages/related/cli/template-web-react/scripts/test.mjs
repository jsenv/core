/*
 * Execute all test files
 * Read more in https://github.com/jsenv/core
 */

import { executeTestPlan, chromium, nodeWorkerThread } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
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
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
  coverage: process.argv.includes("--coverage"),
  githubCheck: false,
});
