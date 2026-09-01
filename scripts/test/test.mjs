/*
 * Execute test files
 * Usage:
 * npm test                 | Execute only tests inside @jsenv/core
 * npm test @jsenv/humanize | Execute only tests inside @jsenv/humanize
 * npm test ./packages/     | Execute only tests inside ./packages/
 * npm test .               | Execute all tests
 */

import {
  chromium,
  executeTestPlan,
  firefox,
  nodeWorkerThread,
  webkit,
} from "@jsenv/test";

if (process.argv.length === 2) {
  process.argv.push("@jsenv/core");
}
if (process.argv[2] === "@jsenv/core") {
  process.argv[2] = "./tests/";
}
await executeTestPlan({
  // remembers how long each execution took; add parallel: { maxAhead: 1 } to
  // let the longest one start ahead of its turn
  executionTimings: true,
  parallel: {
    maxAhead: 1,
  },
  logs: {
    level: "info",
    platformInfo: true,
    memoryUsage: true,
    cpuUsage: true,
  },
  rootDirectoryUrl: new URL("../../", import.meta.url),
  testPlan: {
    "./tests/**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
    "./packages/**/*.test.html": {
      chromium: {
        runtime: chromium(),
      },
      firefox: {
        runtime: firefox({
          disableOnWindowsBecauseFlaky: true,
        }),
      },
      webkit: {
        runtime: webkit(),
      },
    },
    "./packages/**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
    "./packages/**/*.test.js": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
    "./packages/**/with_signal_warnings.test.mjs": {
      node: {
        runtime: nodeWorkerThread({
          commandLineOptions: ["--no-warnings"],
        }),
      },
    },
    // disabled for now
    "./packages/**/https-local/": null,
    // the templates have their own test script that will be trigerred by
    // npm run test:packages
    "./packages/**/cli/": null,
  },
  webServer: {
    origin: "http://127.0.0.1:3456",
    moduleUrl: new URL("../dev/dev.mjs", import.meta.url),
  },
  // githubCheck: process.env.CI
  //   ? {
  //       name: `@jsenv/core tests (${process.platform})`,
  //     }
  //   : null,
});
