import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import {
  executeTestPlan,
  nodeRuntime,
  chromiumRuntime,
  firefoxRuntime,
  webkitRuntime,
} from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}file.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}file.js`
const testPlan = {
  [htmlFileRelativeUrl]: {
    chromium: {
      runtime: chromiumRuntime,
      captureConsole: false,
    },
    firefox: {
      runtime: firefoxRuntime,
      captureConsole: false,
    },
    webkit: {
      runtime: webkitRuntime,
      captureConsole: false,
    },
  },
  [fileRelativeUrl]: {
    node: {
      runtime: nodeRuntime,
      captureConsole: false,
    },
  },
}

const { testPlanSummary, testPlanReport } = await executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
  // logLevel: "info",
  logMemoryHeapUsage: true,
  jsenvDirectoryRelativeUrl,
  testPlan,
})
const actual = {
  testPlanSummary,
  testPlanReport,
}
const expected = {
  testPlanSummary: {
    executionCount: 4,
    abortedCount: 0,
    timedoutCount: 0,
    erroredCount: 0,
    completedCount: 4,
    cancelledCount: 0,
    duration: assert.any(Number),
  },
  testPlanReport: {
    [htmlFileRelativeUrl]: {
      chromium: {
        status: "completed",
        namespace: {
          "./file.js": {
            status: "completed",
            namespace: { default: "browser" },
          },
        },
        runtimeName: "chromium",
        runtimeVersion: assert.any(String),
        duration: assert.any(Number),
      },
      firefox: {
        status: "completed",
        namespace: {
          "./file.js": {
            status: "completed",
            namespace: { default: "browser" },
          },
        },
        runtimeName: "firefox",
        runtimeVersion: assert.any(String),
        duration: assert.any(Number),
      },

      webkit: {
        status: "completed",
        namespace: {
          "./file.js": {
            status: "completed",
            namespace: { default: "browser" },
          },
        },
        runtimeName: "webkit",
        runtimeVersion: assert.any(String),
        duration: assert.any(Number),
      },
    },
    [fileRelativeUrl]: {
      node: {
        status: "completed",
        namespace: {
          default: "node",
        },
        runtimeName: "node",
        runtimeVersion: assert.any(String),
        duration: assert.any(Number),
      },
    },
  },
}
assert({ actual, expected })
