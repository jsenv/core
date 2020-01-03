import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { executeTestPlan } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativePath}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativePath}syntax-error.js`
const { coverageMap: actual } = await executeTestPlan({
  ...EXECUTE_TEST_PARAMS,
  executeLogLevel: "off",
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
