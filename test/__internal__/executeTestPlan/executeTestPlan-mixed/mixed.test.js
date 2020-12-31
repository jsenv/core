import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { executeTestPlan, launchNode } from "@jsenv/core"
import { EXECUTE_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TEST_PLAN.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
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

const actual = await executeTestPlan({
  ...EXECUTE_TEST_PARAMS,
  // put logLevel: "info" to see usual logs about how execution goes
  // here I put "warn" to avoid seeing read things when tests executes
  // otherwise we might things something is wrong
  logLevel: "warn",
  jsenvDirectoryRelativeUrl,
  testPlan,
  compileGroupCount: 1,
  completedExecutionLogAbbreviation: false,
  completedExecutionLogMerging: true,
})
const expected = {
  summary: {
    executionCount: 4,
    disconnectedCount: 0,
    timedoutCount: 0,
    erroredCount: 1,
    completedCount: 3,
    startMs: actual.summary.startMs,
    endMs: actual.summary.endMs,
  },
  report: actual.report,
}
assert({ actual, expected })
