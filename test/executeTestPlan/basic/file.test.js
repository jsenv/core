import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { executeTestPlan, launchNode, launchChromium } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
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
    executionCount: 2,
    disconnectedCount: 0,
    timedoutCount: 0,
    erroredCount: 0,
    completedCount: 2,
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
    },
  },
}
assert({ actual, expected })
