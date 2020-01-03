import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { executeTestPlan } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativePath}.jsenv/`
const { coverageMap } = await executeTestPlan({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  coverage: true,
  testPlan: {},
  coverageConfig: {
    [`./${testDirectoryRelativePath}file.js`]: true,
  },
})
const actual = coverageMap
const expected = {
  [`${testDirectoryRelativePath}file.js`]: {
    ...coverageMap[`${testDirectoryRelativePath}file.js`],
    s: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
  },
}
assert({ actual, expected })
