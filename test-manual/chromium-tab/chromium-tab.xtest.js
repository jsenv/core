import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import {
  executeTestPlan,
  chromiumRuntimeTab,
  chromiumRuntime,
  nodeRuntime,
} from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}file.js`
const headless = false
const testPlan = {
  [fileRelativeUrl]: {
    tab1: {
      runtime: chromiumRuntimeTab,
      runtimeParams: { headless },
    },
    chromium: {
      runtime: chromiumRuntime,
      runtimeParams: { headless },
    },
    tab2: {
      runtime: chromiumRuntimeTab,
      runtimeParams: { headless },
    },
    node: {
      runtime: nodeRuntime,
    },
  },
}
const { testPlanSummary, testPlanReport } = await executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  testPlan,
  // this test exists to ensure chromiumRuntimeTab actually shares
  // the chromium browser and opens tab inside it
  // by passing stopAfterExecute: false,
  // I can manually ensure that after executeTestPlan
  // two chromium are opened (not three)
  // and one of them has two tabs
  // stopAfterExecute: false,
})
const actual = {
  testPlanSummary,
  testPlanReport,
}
const expected = {
  testPlanSummary: {
    executionCount: 4,
    disconnectedCount: 0,
    timedoutCount: 0,
    erroredCount: 0,
    completedCount: 4,
  },
  testPlanReport: {
    [fileRelativeUrl]: {
      tab1: {
        status: "completed",
        namespace: {
          default: 42,
        },
        runtimeName: "chromium",
        runtimeVersion: testPlanReport[fileRelativeUrl].chromium.runtimeVersion,
      },
      chromium: {
        status: "completed",
        namespace: {
          default: 42,
        },
        runtimeName: "chromium",
        runtimeVersion: testPlanReport[fileRelativeUrl].chromium.runtimeVersion,
      },
      tab2: {
        status: "completed",
        namespace: {
          default: 42,
        },
        runtimeName: "chromium",
        runtimeVersion: testPlanReport[fileRelativeUrl].chromium.runtimeVersion,
      },
      node: {
        status: "completed",
        namespace: {
          default: 42,
        },
        runtimeName: "node",
        runtimeVersion: testPlanReport[fileRelativeUrl].node.runtimeVersion,
      },
    },
  },
}
assert({ actual, expected })
