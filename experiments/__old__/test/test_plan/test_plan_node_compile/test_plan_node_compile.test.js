import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { executeTestPlan, nodeRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
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
  },
}
const depFileCompiledUrl = `${testDirectoryUrl}.jsenv/out_system/${testDirectoryRelativeUrl}dep.js`

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
    duration: testPlanSummary.duration,
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
        duration: assert.any(Number),
      },
    },
  },
}
assert({ actual, expected })
