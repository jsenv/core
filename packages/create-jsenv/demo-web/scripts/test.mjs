/*
 * This file uses "@jsenv/core" to execute all test files.
 * See https://github.com/jsenv/jsenv-core/blob/master/docs/testing/readme.md#jsenv-test-runner
 */

import { executeTestPlan, chromium, firefox } from "@jsenv/core"

import { rootDirectoryUrl } from "../jsenv.config.mjs"

await executeTestPlan({
  rootDirectoryUrl,
  testPlan: {
    "./tests/**/*.test.html": {
      chromium: {
        runtime: chromium,
      },
      firefox: {
        runtime: firefox,
      },
    },
  },
  coverage: process.argv.includes("--coverage"),
  coverageForceIstanbul: true,
})
