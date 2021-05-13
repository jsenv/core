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
      launchParams: {
        env: {
          FOO: true,
        },
      },
    },
    node2: {
      launch: launchNode,
      launchParams: {},
    },
  },
}

const getCoverage = async (params) => {
  const result = await executeTestPlan({
    ...EXECUTE_TEST_PLAN_TEST_PARAMS,
    defaultMsAllocatedPerExecution: Infinity,
    logLevel: "info",
    jsenvDirectoryRelativeUrl,
    testPlan,
    coverage: true,
    coverageConfig: {
      [`./${testDirectoryRelativeUrl}message.js`]: true,
    },
    coverageForceIstanbul: true,
    // coverageHtmlDirectory: true,
    // concurrencyLimit: 1,
    ...params,
    // coverageTextLog: true,
    // coverageJsonFile: true,
    // coverageHtmlReport: true,
  })
  return result.testPlanCoverage
}

const actual = await getCoverage()
const expected = {
  [`./${testDirectoryRelativeUrl}message.js`]: {
    ...actual[`./${testDirectoryRelativeUrl}message.js`],
    path: `./${testDirectoryRelativeUrl}message.js`,
    b: {
      0: [2], // c'est nimp
      1: [0],
    },
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
