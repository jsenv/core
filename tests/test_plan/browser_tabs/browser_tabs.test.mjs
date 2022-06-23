/*
 * The goal is to ensure test plan execution in browser tabs works without errors
 */

import { assert } from "@jsenv/assert"

import { executeTestPlan, chromium } from "@jsenv/core"

const result = await executeTestPlan({
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  logLevel: "warn",
  testPlan: {
    "./*.html": {
      a: {
        runtime: chromium,
      },
      b: {
        runtime: chromium,
      },
    },
  },
})
const actual = result
const expected = {
  testPlanAborted: false,
  testPlanSummary: {
    counters: {
      total: 2,
      aborted: 0,
      timedout: 0,
      errored: 0,
      completed: 2,
      done: 2,
      cancelled: 0,
    },
    duration: assert.any(Number),
  },
  testPlanReport: {
    "main.html": {
      a: assert.any(Object),
      b: assert.any(Object),
    },
  },
  testPlanCoverage: undefined,
}
assert({ actual, expected })
