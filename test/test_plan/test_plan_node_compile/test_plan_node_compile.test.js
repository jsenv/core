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
      measureDuration: false,
      captureConsole: false,
    },
  },
}
const depFileCompiledUrl = `${testDirectoryUrl}.jsenv/out-dev/best/${testDirectoryRelativeUrl}dep.js`

const { testPlanSummary, testPlanReport } = await executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  testPlan,
  babelPluginMap: {
    "not-supported": () => {
      return {}
    },
  },
})
const actual = {
  testPlanSummary,
  testPlanReport,
}
const expected = {
  testPlanSummary: {
    executionCount: 1,
    abortedCount: 0,
    timedoutCount: 0,
    erroredCount: 0,
    completedCount: 1,
    cancelledCount: 0,
    startMs: testPlanSummary.startMs,
    endMs: testPlanSummary.endMs,
  },
  testPlanReport: {
    [fileRelativeUrl]: {
      node: {
        status: "completed",
        namespace: {
          depUrl: depFileCompiledUrl,
        },
        runtimeName: "node",
        runtimeVersion: assert.any(String),
      },
    },
  },
}
assert({ actual, expected })
