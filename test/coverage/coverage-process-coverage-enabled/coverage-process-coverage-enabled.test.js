import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  urlToBasename,
} from "@jsenv/filesystem"

import { executeTestPlan, nodeRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryname}.js`

const { testPlanReport } = await executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  testPlan: {
    [fileRelativeUrl]: {
      node: {
        runtime: nodeRuntime,
        captureConsole: false,
      },
    },
  },
  coverage: true,
  coverageConfig: {},
  coverageForceIstanbul: true,
})
const actual = testPlanReport
const expected = {
  [fileRelativeUrl]: {
    node: {
      status: "completed",
      namespace: { COVERAGE_ENABLED: "true" },
      runtimeName: "node",
      runtimeVersion: actual[fileRelativeUrl].node.runtimeVersion,
    },
  },
}
assert({ actual, expected })
