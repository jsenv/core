import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import {
  executeTestPlan,
  nodeRuntime,
  chromiumRuntime,
  firefoxRuntime,
  webkitRuntime,
} from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}coverage_universal.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}coverage_universal.js`
const testPlan = {
  [htmlFileRelativeUrl]: {
    chromium: {
      runtime: chromiumRuntime,
    },
    firefox: {
      runtime: firefoxRuntime,
    },
    webkit: {
      runtime: webkitRuntime,
    },
  },
  [fileRelativeUrl]: {
    node: {
      runtime: nodeRuntime,
    },
    node2: {
      runtime: nodeRuntime,
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
    // maxExecutionsInParallel: 1,
    // logLevel: "info",
    // coverageHtmlDirectory: true,
  })
  return result.testPlanCoverage
}

// without forcing istanbul
{
  const actual = await test({
    coverageForceIstanbul: false,
    coverageV8ConflictWarning: false,
    // coverageHtmlDirectory: true,
    // coverageJsonFile: true,
  })
  const expected = {
    [`./${testDirectoryRelativeUrl}file.js`]: {
      ...actual[`./${testDirectoryRelativeUrl}file.js`],
      path: `./${testDirectoryRelativeUrl}file.js`,
      s: {
        0: 3,
        1: 3,
        2: 1,
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
    coverageV8ConflictWarning: true,
    // coverageHtmlDirectory: true,
    // coverageJsonFile: true,
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
