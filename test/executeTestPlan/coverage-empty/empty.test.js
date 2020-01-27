import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { executeTestPlan } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`

const { coverageMap } = await executeTestPlan({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  coverage: true,
  testPlan: {},
  coverageConfig: {
    [`./${testDirectoryRelativeUrl}file.js`]: true,
  },
})
const actual = coverageMap
const expected = {
  [`${testDirectoryRelativeUrl}file.js`]: {
    ...coverageMap[`${testDirectoryRelativeUrl}file.js`],
    s: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
  },
}
assert({ actual, expected })
