import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { executeTestPlan, nodeRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}file.js`
const testPlan = {
  [fileRelativeUrl]: {
    node: {
      runtime: nodeRuntime,
      captureConsole: false,
    },
    node2: {
      runtime: nodeRuntime,
      captureConsole: false,
    },
  },
}

const abortController = new AbortController()
setTimeout(() => {
  abortController.abort()
}, 4000)
const { testPlanSummary, testPlanReport } = await executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
  signal: abortController.signal,
  jsenvDirectoryRelativeUrl,
  testPlan,
})
const actual = {
  testPlanSummary,
  testPlanReport,
}
const expected = {
  testPlanSummary: {
    executionCount: 2,
    abortedCount: 1,
    timedoutCount: 0,
    erroredCount: 0,
    completedCount: 0,
    cancelledCount: 1,
    duration: assert.any(Number),
  },
  testPlanReport: {
    [fileRelativeUrl]: {
      node: {
        status: "aborted",
        runtimeName: "node",
        runtimeVersion: assert.any(String),
        duration: assert.any(Number),
      },
    },
  },
}
assert({ actual, expected })
