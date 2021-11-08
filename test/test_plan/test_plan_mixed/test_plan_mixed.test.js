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
const testPlan = {
  [`${testDirectoryRelativeUrl}*.spec.js`]: {
    node: {
      runtime: nodeRuntime,
      captureConsole: true,
    },
  },
}

const { testPlanSummary } = await executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
  // put logLevel: "info" to see usual logs about how execution goes
  // here I put "warn" to avoid seeing read things when tests executes
  // otherwise we might things something is wrong
  logLevel: "warn",
  jsenvDirectoryRelativeUrl,
  testPlan,
  completedExecutionLogAbbreviation: false,
  completedExecutionLogMerging: true,
  cooldownBetweenExecutions: 2000,
})
const actual = {
  testPlanSummary,
}
const expected = {
  testPlanSummary: {
    executionCount: 4,
    abortedCount: 0,
    timedoutCount: 0,
    erroredCount: 1,
    completedCount: 3,
    cancelledCount: 0,
    startMs: testPlanSummary.startMs,
    endMs: testPlanSummary.endMs,
  },
}
assert({ actual, expected })
