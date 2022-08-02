/*
 * The goal is to ensure the last error wins
 * and that error stack points to the file:// urls to be clickable
 * TODO
 * - test on firefox
 * - update @jsenv/assert to replace --- at --- by --- path ---
 */

import { assert } from "@jsenv/assert"

import { startDevServer, executeTestPlan, chromium } from "@jsenv/core"

const test = async ({ runtime }) => {
  const rootDirectoryUrl = new URL("./client/", import.meta.url)
  const devServer = await startDevServer({
    logLevel: "warn",
    rootDirectoryUrl,
    keepProcessAlive: false,
    port: 0,
  })
  const { testPlanReport } = await executeTestPlan({
    logLevel: "warn",
    rootDirectoryUrl,
    devServerOrigin: devServer.origin,
    testPlan: {
      "./main.html": {
        browser: { runtime },
      },
    },
  })
  const actual = testPlanReport["main.html"].browser.namespace
  const expected = {
    "/main.html@L10C5-L17C14.js": {
      status: "errored",
      error: `AssertionError: unequal strings
--- found ---
"foo"
--- expected ---
"bar"
--- at ---
value
--- details ---
unexpected character at index 0, "f" was found instead of "b"
    at ${rootDirectoryUrl}main.html:13:12`,
      namespace: null,
    },
    "/main.js": {
      status: "errored",
      error: `AssertionError: unequal values
--- found ---
1
--- expected ---
2
--- at ---
value
    at ${rootDirectoryUrl}main.js:3:1`,
      namespace: null,
    },
  }
  assert({ actual, expected })
}

await test({ runtime: chromium })
