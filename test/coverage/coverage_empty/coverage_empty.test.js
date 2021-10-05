/*

The goal here is to test that when there is no test plan,
coverage is collected and is accurate.

*/

import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { executeTestPlan } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const { testPlanCoverage } = await executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  coverage: true,
  testPlan: {},
  coverageConfig: {
    [`./${testDirectoryRelativeUrl}coverage_empty.js`]: true,
  },
})

const actual = testPlanCoverage
const expected = {
  [`./${testDirectoryRelativeUrl}coverage_empty.js`]: {
    ...testPlanCoverage[`./${testDirectoryRelativeUrl}coverage_empty.js`],
    s: {
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
    },
  },
}
assert({ actual, expected })
