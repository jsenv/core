/*
 * This file uses "@jsenv/core" to execute all test files.
 * See https://github.com/jsenv/jsenv-core/blob/master/docs/testing/readme.md#jsenv-test-runner
 */

import { executeTestPlan, chromium, firefox } from "@jsenv/core"

import { rootDirectoryUrl, plugins } from "../jsenv.config.mjs"

await executeTestPlan({
  rootDirectoryUrl,
  plugins,
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
  coverageJsonFileRelativeUrl: "coverage/coverage.json",
  coverageForceIstanbul: true,
})
