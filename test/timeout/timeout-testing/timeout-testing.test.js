import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"
import { executeTestPlan, launchNode } from "@jsenv/core"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryname}.js`
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
      measureDuration: false,
      captureConsole: false,
    },
  },
}

const { testPlanSummary, testPlanReport } = await executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
  executionLogLevel: "error",
  jsenvDirectoryRelativeUrl,
  testPlan,
})
const actual = {
  testPlanSummary,
  testPlanReport,
}
const expected = {
  testPlanSummary: {
    executionCount: 1,
    disconnectedCount: 0,
    timedoutCount: 1,
    erroredCount: 0,
    completedCount: 0,
    startMs: testPlanSummary.startMs,
    endMs: testPlanSummary.endMs,
  },
  testPlanReport: {
    [fileRelativeUrl]: {
      node: {
        status: "timedout",
        runtimeName: "node",
        runtimeVersion: testPlanReport[fileRelativeUrl].node.runtimeVersion,
      },
    },
  },
}
assert({ actual, expected })
