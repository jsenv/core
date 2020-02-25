import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { executeTestPlan, launchChromiumTab, launchChromium, launchNode } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}file.js`
const headless = false
const testPlan = {
  [fileRelativeUrl]: {
    tab1: {
      launch: (options) => launchChromiumTab({ ...options, headless }),
    },
    chromium: {
      launch: (options) => launchChromium({ ...options, headless }),
    },
    tab2: {
      launch: (options) => launchChromiumTab({ ...options, headless }),
    },
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
    executionCount: 4,
    disconnectedCount: 0,
    timedoutCount: 0,
    erroredCount: 0,
    completedCount: 4,
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
      node: {
        status: "completed",
        namespace: {
          default: 42,
        },
        platformName: "node",
        platformVersion: actual.report[fileRelativeUrl].node.platformVersion,
      },
    },
  },
}
assert({ actual, expected })
