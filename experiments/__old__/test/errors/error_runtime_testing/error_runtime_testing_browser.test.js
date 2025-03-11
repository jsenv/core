import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { executeTestPlan, chromiumRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}file.spec.html`
const testPlan = {
  [htmlFileRelativeUrl]: {
    chromium: {
      runtime: chromiumRuntime,
      runtimeParams: {
        // headless: false
      },
      captureConsole: true,
    },
  },
}
const { testPlanSummary, testPlanReport } = await executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  testPlan,
  launchAndExecuteLogLevel: "off",
  // stopAfterExecute: false,
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
    erroredCount: 1,
    completedCount: 0,
    cancelledCount: 0,
    duration: testPlanSummary.duration,
  },
  testPlanReport: {
    [htmlFileRelativeUrl]: {
      chromium: {
        status: "errored",
        error: new Error(`ask() should return 42, got 40`),
        namespace: testPlanReport[htmlFileRelativeUrl].chromium.namespace,
        consoleCalls: testPlanReport[htmlFileRelativeUrl].chromium.consoleCalls,
        runtimeName: "chromium",
        runtimeVersion: assert.any(String),
        duration: assert.any(Number),
      },
    },
  },
}
assert({ actual, expected })
