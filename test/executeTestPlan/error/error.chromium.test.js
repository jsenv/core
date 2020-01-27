import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { executeTestPlan, launchChromium } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}file.spec.js`
const testPlan = {
  [fileRelativeUrl]: {
    chromium: {
      launch: launchChromium,
      captureConsole: true,
    },
  },
}
const actual = await executeTestPlan({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  testPlan,
  executeLogLevel: "off",
})
const expected = {
  summary: {
    executionCount: 1,
    disconnectedCount: 0,
    timedoutCount: 0,
    erroredCount: 1,
    completedCount: 0,
  },
  report: {
    [fileRelativeUrl]: {
      chromium: {
        status: "errored",
        error: new Error(`ask() should return 42, got 40`),
        consoleCalls: [],
        platformName: "chromium",
        platformVersion: actual.report[fileRelativeUrl].chromium.platformVersion,
      },
    },
  },
}
assert({ actual, expected })
