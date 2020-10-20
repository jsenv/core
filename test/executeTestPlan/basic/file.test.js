import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  executeTestPlan,
  launchNode,
  launchChromium,
  launchFirefox,
  launchWebkit,
} from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}file.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}file.js`
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
  },
}

const actual = await executeTestPlan({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  testPlan,
  compileGroupCount: 1,
})
const expected = {
  summary: {
    executionCount: 4,
    disconnectedCount: 0,
    timedoutCount: 0,
    erroredCount: 0,
    completedCount: 4,
    startMs: actual.summary.startMs,
    endMs: actual.summary.endMs,
  },
  report: {
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
