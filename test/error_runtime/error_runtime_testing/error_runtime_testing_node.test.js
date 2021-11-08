import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { executeTestPlan, nodeRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}file.spec.js`
const testPlan = {
  [fileRelativeUrl]: {
    node: {
      runtime: nodeRuntime,
      captureConsole: true,
    },
  },
}
const { testPlanSummary, testPlanReport } = await executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  testPlan,
  launchAndExecuteLogLevel: "off",
})

const actual = {
  testPlanSummary,
  testPlanReport,
  errorInLogs: testPlanReport[fileRelativeUrl].node.consoleCalls.some(
    ({ text }) => text.includes(`should return 42`),
  ),
}
const expected = {
  testPlanSummary: {
    executionCount: 1,
    abortedCount: 0,
    timedoutCount: 0,
    erroredCount: 1,
    completedCount: 0,
    cancelledCount: 0,
    duration: testPlanSummary.duration,
  },
  testPlanReport: {
    [fileRelativeUrl]: {
      node: {
        status: "errored",
        error: new Error(`ask() should return 42, got 40`),
        consoleCalls: testPlanReport[fileRelativeUrl].node.consoleCalls,
        runtimeName: "node",
        runtimeVersion: testPlanReport[fileRelativeUrl].node.runtimeVersion,
        duration: assert.any(Number),
      },
    },
  },
  // error should not be in logs
  errorInLogs: false,
}
assert({ actual, expected })
