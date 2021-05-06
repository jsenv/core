import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, urlToBasename } from "@jsenv/util"

import {
  executeTestPlan,
  launchNode,
  launchChromium,
  launchFirefox,
  launchWebkit,
} from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryname}.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryname}.js`
const testPlan = {
  [htmlFileRelativeUrl]: {
    chromium: {
      launch: launchChromium,
    },
    firefox: {
      launch: launchFirefox,
    },
    webkit: {
      launch: launchWebkit,
    },
  },
  [fileRelativeUrl]: {
    node: {
      launch: launchNode,
    },
    node2: {
      launch: launchNode,
    },
  },
}

const test = async (options = {}) => {
  const result = await executeTestPlan({
    ...EXECUTE_TEST_PLAN_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    testPlan,
    coverage: true,
    coverageConfig: {
      [`./${testDirectoryRelativeUrl}file.js`]: true,
    },
    ...options,
    // concurrencyLimit: 1,
    // logLevel: "info",
    // coverageHtmlDirectory: true,
  })
  return result.testPlanCoverage
}

// without forcing istanbul
// for some reason I can't explain, when this gets executed by CI it fails
if (!process.env.CI) {
  const actual = await test({
    coverageV8MergeConflictIsExpected: true,
  })
  const expected = {
    [`./${testDirectoryRelativeUrl}file.js`]: {
      ...actual[`./${testDirectoryRelativeUrl}file.js`],
      path: `./${testDirectoryRelativeUrl}file.js`,
      s: {
        0: 2,
        1: 2,
        2: 0,
        3: 2,
        4: 2,
        5: 2,
        6: 0,
        7: 0,
      },
    },
  }
  assert({ actual, expected })
}

// forcing istanbul
{
  const actual = await test({
    coverageForceIstanbul: true,
  })
  const expected = {
    [`./${testDirectoryRelativeUrl}file.js`]: {
      ...actual[`./${testDirectoryRelativeUrl}file.js`],
      path: `./${testDirectoryRelativeUrl}file.js`,
      s: {
        0: 5,
        1: 3,
        2: 2,
        3: 2,
        4: 0,
      },
    },
  }
  assert({ actual, expected })
}
