/*
 * Execute all test files
 * Read more in https://github.com/jsenv/core/wiki
 */

import { executeTestPlan, chromium, nodeWorkerThread } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../", import.meta.url),
  testPlan: {
    "./src/**/*.test.html": {
      chromium: {
        runtime: chromium(),
      },
    },
    "./src/**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
  },
  webServer: {
    origin: "http://localhost:3400",
    rootDirectoryUrl: new URL("../src/", import.meta.url),
    moduleUrl: new URL("./dev.mjs", import.meta.url),
  },
  coverage: process.argv.includes("--coverage"),
  githubCheck: false,
});
