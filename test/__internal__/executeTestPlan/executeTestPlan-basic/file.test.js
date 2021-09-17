import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

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
      launch: launchChromium,
      measureDuration: false,
      captureConsole: false,
    },
    firefox: {
      launch: launchFirefox,
      measureDuration: false,
      captureConsole: false,
    },
    webkit: {
      launch: launchWebkit,
      measureDuration: false,
      captureConsole: false,
    },
  },
  [fileRelativeUrl]: {
    node: {
      launch: launchNode,
      measureDuration: false,
      captureConsole: false,
    },
  },
}

const { testPlanSummary, testPlanReport } = await executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  testPlan,
  compileGroupCount: 1,
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
    startMs: testPlanSummary.startMs,
    endMs: testPlanSummary.endMs,
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
      },
    },
  },
}
assert({ actual, expected })
