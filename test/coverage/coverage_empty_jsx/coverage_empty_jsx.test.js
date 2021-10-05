import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { executeTestPlan } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`

// without syntax-jsx babel plugin we get an empty coverage
{
  const { testPlanCoverage } = await executeTestPlan({
    ...EXECUTE_TEST_PLAN_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    coverage: true,
    testPlan: {},
    coverageConfig: {
      [`./${testDirectoryRelativeUrl}coverage_empty.jsx`]: true,
    },
    babelConfigFileUrl: undefined,
  })

  const actual = testPlanCoverage
  const expected = {
    [`./${testDirectoryRelativeUrl}coverage_empty.jsx`]: {
      ...testPlanCoverage[`./${testDirectoryRelativeUrl}coverage_empty.jsx`],
      s: {},
    },
  }
  assert({ actual, expected })
}

// with syntax-js we get a real empty coverage
{
  const { testPlanCoverage } = await executeTestPlan({
    ...EXECUTE_TEST_PLAN_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    coverage: true,
    testPlan: {},
    coverageConfig: {
      [`./${testDirectoryRelativeUrl}coverage_empty.jsx`]: true,
    },
    babelConfigFileUrl: new URL("./babel.config.cjs", import.meta.url),
  })

  const actual = testPlanCoverage
  const expected = {
    [`./${testDirectoryRelativeUrl}coverage_empty.jsx`]: {
      ...testPlanCoverage[`./${testDirectoryRelativeUrl}coverage_empty.jsx`],
      s: {
        0: 0,
        1: 0,
        2: 0,
        3: 0,
      },
    },
  }
  assert({ actual, expected })
}
