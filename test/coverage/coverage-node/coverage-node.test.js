import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"
import { executeTestPlan, launchNode } from "@jsenv/core"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryname}.js`
const testPlan = {
  [fileRelativeUrl]: {
    node: {
      launch: launchNode,
    },
  },
}

const result = await executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  testPlan,
  coverage: true,
  coverageConfig: {
    [`./${testDirectoryRelativeUrl}file.js`]: true,
  },
  // coverageTextLog: true,
  // coverageJsonFile: true,
  // coverageHtmlDirectory: true,
})
const actual = result.coverageMap
const expected = {
  [`${testDirectoryRelativeUrl}file.js`]: {
    ...actual[`${testDirectoryRelativeUrl}file.js`],
    path: `./${testDirectoryRelativeUrl}file.js`,
    s: {
      0: 1,
      1: 1,
      2: 0,
      3: 1,
      4: 1,
      5: 1,
      6: 0,
      7: 0,
    },
  },
}
assert({ actual, expected })
