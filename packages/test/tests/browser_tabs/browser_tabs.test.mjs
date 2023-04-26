/*
 * The goal is to ensure test plan execution in browser tabs works without errors
 */

import { assert } from "@jsenv/assert"
import { startDevServer } from "@jsenv/core"

import { executeTestPlan, chromium } from "@jsenv/test"

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  port: 0,
})
const result = await executeTestPlan({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./client/*.html": {
      a: {
        runtime: chromium,
      },
      b: {
        runtime: chromium,
      },
    },
  },
  webServer: {
    origin: devServer.origin,
    rootDirectoryUrl: new URL("./client/", import.meta.url),
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
      failed: 0,
      completed: 2,
      done: 2,
      cancelled: 0,
    },
    duration: assert.any(Number),
  },
  testPlanReport: {
    "client/main.html": {
      a: assert.any(Object),
      b: assert.any(Object),
    },
  },
  testPlanCoverage: undefined,
}
assert({ actual, expected })
