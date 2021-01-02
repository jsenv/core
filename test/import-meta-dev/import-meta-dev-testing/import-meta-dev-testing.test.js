import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"
import { executeTestPlan, launchNode, launchChromium } from "@jsenv/core"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const testDirectoryname = basename(testDirectoryRelativeUrl)
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryname}.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryname}.js`
const { report } = await executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  testPlan: {
    [htmlFileRelativeUrl]: {
      chromium: {
        launch: launchChromium,
      },
    },
    [fileRelativeUrl]: {
      node: {
        launch: launchNode,
      },
    },
  },
})
const actual = report
const expected = {
  [htmlFileRelativeUrl]: {
    chromium: {
      status: "completed",
      namespace: {
        [`./${testDirectoryname}.js`]: {
          status: "completed",
          namespace: {
            importMetaDev: true,
          },
        },
      },
      runtimeName: "chromium",
      runtimeVersion: actual[htmlFileRelativeUrl].chromium.runtimeVersion,
    },
  },
  [fileRelativeUrl]: {
    node: {
      status: "completed",
      namespace: {
        importMetaDev: true,
      },
      runtimeName: "node",
      runtimeVersion: actual[fileRelativeUrl].node.runtimeVersion,
    },
  },
}
assert({ actual, expected })
