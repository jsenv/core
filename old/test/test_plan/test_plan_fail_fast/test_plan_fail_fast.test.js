import { assert } from "@jsenv/assert"
import { readFile, resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { executeTestPlan, nodeRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
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
    },
  },
}
const { testPlanSummary } = await executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
  // put logLevel: "info" to see usual logs about how execution goes
  // here I put "warn" to avoid seeing read things when tests executes
  // otherwise we might things something is wrong
  logLevel: "warn",
  failFast: true,
  jsenvDirectoryRelativeUrl,
  logFileRelativeUrl: `${jsenvDirectoryRelativeUrl}test_plan_debug.txt`,
  testPlan,
  completedExecutionLogAbbreviation: false,
  completedExecutionLogMerging: true,
})
const logFileContent = await readFile(
  new URL("./.jsenv/test_plan_debug.txt", import.meta.url),
)
const actual = {
  logFileContentIncludes:
    logFileContent.includes(`-------------- summary -----------------
3 executions: 1 errored, 1 completed, 1 cancelled
total duration:`),
  testPlanSummary,
}
const expected = {
  logFileContentIncludes: true,
  testPlanSummary: {
    executionCount: 3,
    abortedCount: 0,
    timedoutCount: 0,
    erroredCount: 1,
    completedCount: 1,
    cancelledCount: 1,
    duration: testPlanSummary.duration,
  },
}
assert({ actual, expected })
