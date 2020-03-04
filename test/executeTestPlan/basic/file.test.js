import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
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
const fileRelativeUrl = `${testDirectoryRelativeUrl}file.js`
const testPlan = {
  [fileRelativeUrl]: {
    node: {
      launch: launchNode,
    },
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
    [fileRelativeUrl]: {
      node: {
        status: "completed",
        namespace: {
          default: "node",
        },
        runtimeName: "node",
        runtimeVersion: actual.report[fileRelativeUrl].node.runtimeVersion,
      },
      chromium: {
        status: "completed",
        namespace: {
          default: "browser",
        },
        runtimeName: "chromium",
        runtimeVersion: actual.report[fileRelativeUrl].chromium.runtimeVersion,
      },
      firefox: {
        status: "completed",
        namespace: {
          default: "browser",
        },
        runtimeName: "firefox",
        runtimeVersion: actual.report[fileRelativeUrl].firefox.runtimeVersion,
      },
      webkit: {
        status: "completed",
        namespace: {
          default: "browser",
        },
        runtimeName: "webkit",
        runtimeVersion: actual.report[fileRelativeUrl].webkit.runtimeVersion,
      },
    },
  },
}
assert({ actual, expected })
