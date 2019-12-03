import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { executeTestPlan, launchNode, launchChromium } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativePath}.jsenv/`
const { coverageMap: actual } = await executeTestPlan({
  ...EXECUTE_TEST_PARAMS,
  executeLogLevel: "off",
  jsenvDirectoryRelativeUrl,
  testPlan: {
    [`${testDirectoryRelativePath}import-throw.js`]: {
      chromium: {
        launch: launchChromium,
      },
      node: {
        launch: launchNode,
      },
    },
  },
  coverage: true,
  coverageConfig: {
    [`${testDirectoryRelativePath}throw.js`]: true,
  },
})
const expected = {
  [`${testDirectoryRelativePath}throw.js`]: {
    ...actual[`${testDirectoryRelativePath}throw.js`],
    s: { 0: 2, 1: 2 },
  },
}
assert({ actual, expected })
