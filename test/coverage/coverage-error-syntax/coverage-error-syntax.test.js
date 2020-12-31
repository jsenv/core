import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"
import { executeTestPlan } from "@jsenv/core"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const testDirectoryname = basename(testDirectoryRelativeUrl)
const fileRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryname}.js`
const { coverageMap: actual } = await executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
  executionLogLevel: "off",
  jsenvDirectoryRelativeUrl,
  testPlan: {},
  coverage: true,
  coverageConfig: {
    [fileRelativeUrl]: true,
  },
})
const expected = {
  [fileRelativeUrl]: {
    ...actual[fileRelativeUrl],
    s: {},
  },
}
assert({ actual, expected })
