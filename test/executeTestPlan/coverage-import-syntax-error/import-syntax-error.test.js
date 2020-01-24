import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
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
    [`${testDirectoryRelativePath}import-syntax-error.js`]: {
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
    [`${testDirectoryRelativePath}syntax-error.js`]: true,
  },
})
const expected = {
  [`${testDirectoryRelativePath}syntax-error.js`]: {
    ...actual[`${testDirectoryRelativePath}syntax-error.js`],
    s: {},
  },
}
assert({ actual, expected })
