import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, urlToBasename } from "@jsenv/util"

import { executeTestPlan, launchNode } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryname}.js`
const testPlan = {
  [fileRelativeUrl]: {
    node: {
      launch: launchNode,
    },
    node2: {
      launch: launchNode,
      launchParams: {
        env: {
          FOO: true,
        },
      },
    },
  },
}

const getCoverage = async (params) => {
  const result = await executeTestPlan({
    ...EXECUTE_TEST_PLAN_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    testPlan,
    coverage: true,
    coverageConfig: {
      [`./${testDirectoryRelativeUrl}file.js`]: true,
    },
    // coverageHtmlDirectory: true,
    ...params,
    // coverageTextLog: true,
    // coverageJsonFile: true,
    // coverageHtmlReport: true,
  })
  return result.testPlanCoverage
}

const actual = await getCoverage()
const expected = {
  [`./${testDirectoryRelativeUrl}file.js`]: {
    ...actual[`./${testDirectoryRelativeUrl}file.js`],
    path: `./${testDirectoryRelativeUrl}file.js`,
    s: {
      0: 2,
      1: 1,
      2: 2,
      3: 1,
      4: 1,
    },
  },
}
assert({ actual, expected })
