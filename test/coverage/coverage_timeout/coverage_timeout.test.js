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
const fileRelativeUrl = `${testDirectoryRelativeUrl}coverage_timeout.js`
const testPlan = {
  [fileRelativeUrl]: {
    node: {
      runtime: nodeRuntime,
      runtimeParams: {
        env: { AWAIT_FOREVER: true },
      },
      allocatedMs: 5000,
      gracefulStopAllocatedMs: 1000,
    },
  },
}

const { testPlanCoverage } = await executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
  // launchAndExecuteLogLevel: "debug",
  jsenvDirectoryRelativeUrl,
  testPlan,
  coverage: true,
  coverageAndExecutionAllowed: true,
  coverageConfig: {
    [fileRelativeUrl]: true,
  },
})

const actual = testPlanCoverage
const expected = {
  [`./${fileRelativeUrl}`]: {
    ...actual[`./${fileRelativeUrl}`],
    s: { 0: 0, 1: 0, 2: 0 },
  },
}
assert({ actual, expected })
