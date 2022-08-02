/*
 * The goal is to ensure the last error wins
 * and that error stack points to the file:// urls to be clickable
 */

import { assert } from "@jsenv/assert"

import { startDevServer, executeTestPlan, chromium } from "@jsenv/core"

const test = async ({ runtime }) => {
  const devServer = await startDevServer({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    port: 0,
  })
  const { testPlanReport } = await executeTestPlan({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    devServerOrigin: devServer.origin,
    testPlan: {
      "./*.html": {
        a: { runtime },
      },
    },
  })
  const actual = {
    errorStack: testPlanReport["main.html"].a.error.stack,
  }
  const expected = {
    errorStack: `AssertionError: unequal strings
  --- found ---
  "foo"
  --- expected ---
  "bar"
  --- at ---
  value
  --- details ---
  unexpected character at index 0, "f" was found instead of "b"
      at ${devServer.origin}/main.html@L10C5-L17C14.js:4:7`,
  }
  assert({ actual, expected })
}

await test({ runtime: chromium })
