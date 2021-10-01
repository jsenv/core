import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { executeTestPlan, launchNode, launchChromium } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}error_syntax.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}importing_error_syntax.js`
const { testPlanCoverage } = await executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
  executionLogLevel: "off",
  jsenvDirectoryRelativeUrl,
  testPlan: {
    [htmlFileRelativeUrl]: {
      chromium: {
        launch: launchChromium,
      },
    },
    [fileRelativeUrl]: {
      node: {
        launch: launchNode,
      },
    },
  },
  coverage: true,
  coverageConfig: {
    [`${testDirectoryRelativeUrl}error_syntax.js`]: true,
  },
})
const actual = testPlanCoverage
const expected = {
  [`./${testDirectoryRelativeUrl}error_syntax.js`]: {
    ...actual[`./${testDirectoryRelativeUrl}error_syntax.js`],
    s: {},
  },
}
assert({ actual, expected })
