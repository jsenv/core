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
  // collectPlatformVersion: {
  //   collectPlatformVersion: false,
  // },
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
        platformName: "node",
        platformVersion: actual.report[fileRelativeUrl].node.platformVersion,
      },
      chromium: {
        status: "completed",
        namespace: {
          default: "browser",
        },
        platformName: "chromium",
        platformVersion: actual.report[fileRelativeUrl].chromium.platformVersion,
      },
      firefox: {
        status: "completed",
        namespace: {
          default: "browser",
        },
        platformName: "firefox",
        platformVersion: actual.report[fileRelativeUrl].firefox.platformVersion,
      },
      webkit: {
        status: "completed",
        namespace: {
          default: "browser",
        },
        platformName: "webkit",
        platformVersion: actual.report[fileRelativeUrl].webkit.platformVersion,
      },
    },
  },
}
assert({ actual, expected })
