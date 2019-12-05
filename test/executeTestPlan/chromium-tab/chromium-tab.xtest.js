import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { executeTestPlan, launchChromiumTab, launchChromium } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}file.js`
const testPlan = {
  [fileRelativeUrl]: {
    tab1: {
      launch: launchChromiumTab,
    },
    chromium: {
      launch: launchChromium,
    },
    tab2: {
      launch: launchChromiumTab,
    },
  },
}
const actual = await executeTestPlan({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  testPlan,
  compileGroupCount: 1,
  // this test exists to ensure launchChromiumTab actually shares
  // the chromium browser and opens tab inside it
  // by passing stopPlatformAfterExecute: false,
  // I can manually ensure that after executeTestPlan
  // two chromium are opened (not three)
  // and one of them has two tabs
  // stopPlatformAfterExecute: false,
})
const expected = {
  summary: {
    executionCount: 3,
    disconnectedCount: 0,
    timedoutCount: 0,
    erroredCount: 0,
    completedCount: 3,
  },
  report: {
    [fileRelativeUrl]: {
      tab1: {
        status: "completed",
        namespace: {
          default: 42,
        },
        platformName: "chromium",
        platformVersion: actual.report[fileRelativeUrl].chromium.platformVersion,
      },
      chromium: {
        status: "completed",
        namespace: {
          default: 42,
        },
        platformName: "chromium",
        platformVersion: actual.report[fileRelativeUrl].chromium.platformVersion,
      },
      tab2: {
        status: "completed",
        namespace: {
          default: 42,
        },
        platformName: "chromium",
        platformVersion: actual.report[fileRelativeUrl].chromium.platformVersion,
      },
    },
  },
}
assert({ actual, expected })
