/*
 * The goal here is to ensure test plan can be used with an other server
 * than jsenv
 */

import { assert } from "@jsenv/assert"
import { startBuildServer, executeTestPlan, chromium } from "@jsenv/core"

const buildServer = await startBuildServer({
  logLevel: "warn",
  buildDirectoryUrl: new URL("./project/public/", import.meta.url),
  keepProcessAlive: false,
})

const result = await executeTestPlan({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./project/", import.meta.url),
  testPlan: {
    "./public/**/*.test.html": {
      chromium: {
        runtime: chromium,
      },
    },
  },
  // keepRunning: true,
  webServer: {
    origin: buildServer.origin,
    rootDirectoryUrl: new URL("./project/public/", import.meta.url),
  },
})

const chromiumResult = result.testPlanReport["public/main.test.html"].chromium
const actual = {
  status: chromiumResult.status,
  errorMessage: chromiumResult.errors[0].message,
}
const expected = {
  status: "failed",
  errorMessage: "answer should be 42, got 43",
}
assert({ actual, expected })
