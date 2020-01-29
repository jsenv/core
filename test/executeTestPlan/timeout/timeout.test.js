import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { executeTestPlan, launchNode } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}timeout.js`
const testPlan = {
  [fileRelativeUrl]: {
    node: {
      launch: (options) =>
        launchNode({
          ...options,
          env: { AWAIT_FOREVER: true },
        }),
      allocatedMs: 8000,
      gracefulStopAllocatedMs: 5000,
    },
  },
}

const actual = await executeTestPlan({
  ...EXECUTE_TEST_PARAMS,
  executeLogLevel: "error",
  jsenvDirectoryRelativeUrl,
  testPlan,
})
const expected = {
  summary: {
    executionCount: 1,
    disconnectedCount: 0,
    timedoutCount: 1,
    erroredCount: 0,
    completedCount: 0,
  },
  report: {
    [fileRelativeUrl]: {
      node: {
        status: "timedout",
        platformName: "node",
        platformVersion: actual.report[fileRelativeUrl].node.platformVersion,
      },
    },
  },
}
assert({ actual, expected })
