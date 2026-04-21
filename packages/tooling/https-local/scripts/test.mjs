/*
 * This file uses "@jsenv/core" to execute all test files.
 * See https://github.com/jsenv/jsenv-core/blob/master/docs/testing/readme.md#jsenv-test-runner
 */

import { executeTestPlan, nodeChildProcess } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: import.meta.resolve("../"),
  testPlan: {
    "tests/**/*.test.mjs": {
      node: {
        runtime: nodeChildProcess(),
      },
    },
  },
  // authority_certificate tests share cert files on disk; run sequentially to avoid race conditions
  parallel: false,
});
