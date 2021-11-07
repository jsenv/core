import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { executeTestPlan, chromiumRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}coverage_chromium_v8.html`
const testPlan = {
  [htmlFileRelativeUrl]: {
    chromium: {
      runtime: chromiumRuntime,
      runtimeParams: {
        // headless: false,
      },
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
    // defaultMsAllocatedPerExecution: Infinity,
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
    coverageV8ConflictWarning: false,
  })
  const expected = {
    [`./${testDirectoryRelativeUrl}file.js`]: {
      ...actual[`./${testDirectoryRelativeUrl}file.js`],
      path: `./${testDirectoryRelativeUrl}file.js`,
      s: {
        0: 1,
        1: 1,
        2: 1,
        3: 1,
        4: 0,
        5: 0,
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
        0: 1,
        1: 1,
        2: 0,
        3: 0,
        4: 0,
      },
    },
  }
  assert({ actual, expected })
}
