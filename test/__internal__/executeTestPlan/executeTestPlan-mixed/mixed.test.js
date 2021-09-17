import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { executeTestPlan, launchNode } from "@jsenv/core"
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
      launch: launchNode,
      measureDuration: true,
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
  compileGroupOptions: {
    groupCount: 1,
  },
  completedExecutionLogAbbreviation: false,
  completedExecutionLogMerging: true,
})
const actual = {
  testPlanSummary,
}
const expected = {
  testPlanSummary: {
    executionCount: 4,
    disconnectedCount: 0,
    timedoutCount: 0,
    erroredCount: 1,
    completedCount: 3,
    startMs: testPlanSummary.startMs,
    endMs: testPlanSummary.endMs,
  },
}
assert({ actual, expected })
