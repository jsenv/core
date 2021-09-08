import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, urlToBasename } from "@jsenv/filesystem"

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
    ...params,
    // coverageTextLog: true,
    // coverageJsonFile: true,
    // coverageHtmlDirectory: true,
  })
  return result.testPlanCoverage
}

// v8
{
  const actual = await getCoverage({
    coverageForceIstanbul: false,
  })
  const expected = {
    [`./${testDirectoryRelativeUrl}file.js`]: {
      ...actual[`./${testDirectoryRelativeUrl}file.js`],
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
}

// istanbul
{
  const actual = await getCoverage({
    coverageForceIstanbul: true,
  })
  const expected = {
    [`./${testDirectoryRelativeUrl}file.js`]: {
      ...actual[`./${testDirectoryRelativeUrl}file.js`],
      path: `./${testDirectoryRelativeUrl}file.js`,
      s: {
        0: 1,
        1: 0,
        2: 1,
        3: 1,
        4: 0,
      },
    },
  }
  assert({ actual, expected })
}
