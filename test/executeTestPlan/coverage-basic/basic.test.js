import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { executeTestPlan, launchNode } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}use-file.js`
const testPlan = {
  [fileRelativeUrl]: {
    node: {
      launch: launchNode,
    },
    node2: {
      launch: launchNode,
    },
  },
}

const { coverageMap } = await executeTestPlan({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  testPlan,
  coverage: true,
  coverageConfig: {
    [`./${testDirectoryRelativeUrl}file.js`]: true,
  },
})
const actual = coverageMap
const expected = {
  [`${testDirectoryRelativeUrl}file.js`]: {
    ...coverageMap[`${testDirectoryRelativeUrl}file.js`],
    path: `./${testDirectoryRelativeUrl}file.js`,
    s: { 0: 2, 1: 0, 2: 2, 3: 2, 4: 0 },
  },
}
assert({ actual, expected })
