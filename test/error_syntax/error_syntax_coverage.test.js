import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { executeTestPlan } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}error_syntax.js`
const { testPlanCoverage } = await executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
  executionLogLevel: "off",
  jsenvDirectoryRelativeUrl,
  testPlan: {},
  coverage: true,
  coverageConfig: {
    [fileRelativeUrl]: true,
  },
})

const actual = testPlanCoverage
const expected = {
  [`./${fileRelativeUrl}`]: {
    ...actual[`./${fileRelativeUrl}`],
    s: {},
  },
}
assert({ actual, expected })
