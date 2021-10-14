import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  urlToBasename,
} from "@jsenv/filesystem"

import { executeTestPlan, nodeRuntime, chromiumRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryname}.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryname}.js`

const { testPlanCoverage } = await executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
  executionLogLevel: "off",
  jsenvDirectoryRelativeUrl,
  testPlan: {
    [htmlFileRelativeUrl]: {
      chromium: {
        runtime: chromiumRuntime,
      },
    },
    [fileRelativeUrl]: {
      node: {
        runtime: nodeRuntime,
        runtimeParams: {
          // logProcessCommand: true,
        },
      },
    },
  },
  coverage: true,
  coverageConfig: {
    [`${testDirectoryRelativeUrl}throw.js`]: true,
  },
  coverageForceIstanbul: true,
})
const actual = testPlanCoverage
const expected = {
  [`./${testDirectoryRelativeUrl}throw.js`]: {
    ...actual[`./${testDirectoryRelativeUrl}throw.js`],
    s: {
      0: 2,
      1: 2,
    },
  },
}
assert({ actual, expected })
