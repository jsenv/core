/*
https://github.com/bcoe/c8/issues/116#issuecomment-503039423
https://github.com/SimenB/jest/blob/917efc3398577c205f33c1c2f9a1aeabfaad6f7d/packages/jest-coverage/src/index.ts
*/

import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { executeTestPlan, nodeRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}coverage_node_merge.js`
const testPlan = {
  [fileRelativeUrl]: {
    node: {
      runtime: nodeRuntime,
      runtimeParams: {
        env: {
          FOO: true,
        },
      },
    },
    node2: {
      runtime: nodeRuntime,
      runtimeParams: {},
    },
  },
}

const getCoverage = async (params) => {
  const result = await executeTestPlan({
    ...EXECUTE_TEST_PLAN_TEST_PARAMS,
    defaultMsAllocatedPerExecution: Infinity,
    // logLevel: "info",
    // launchAndExecuteLogLevel: "debug",
    jsenvDirectoryRelativeUrl,
    testPlan,
    coverage: true,
    coverageConfig: {
      [`./${testDirectoryRelativeUrl}message.js`]: true,
    },
    // coverageHtmlDirectory: true,
    // maxExecutionsInParallel: 1,
    ...params,
    // coverageTextLog: true,
    // coverageJsonFile: true,
    // coverageHtmlReport: true,
  })
  return result.testPlanCoverage
}

const actual = await getCoverage({
  coverageForceIstanbul: false,
})
const expected = {
  [`./${testDirectoryRelativeUrl}message.js`]: {
    ...actual[`./${testDirectoryRelativeUrl}message.js`],
    path: `./${testDirectoryRelativeUrl}message.js`,
    b: {
      0: [2],
      1: [1],
    },
    s: {
      0: 2,
      1: 1,
      2: 1,
      3: 1,
      4: 1,
    },
  },
}
assert({ actual, expected })
