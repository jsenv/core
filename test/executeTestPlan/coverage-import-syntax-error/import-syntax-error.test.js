import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { executeTestPlan, launchNode, launchChromium } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}import-syntax-error.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}import-syntax-error.js`
const { coverageMap: actual } = await executeTestPlan({
  ...EXECUTE_TEST_PARAMS,
  executionLogLevel: "off",
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
  coverage: true,
  coverageConfig: {
    [`${testDirectoryRelativeUrl}syntax-error.js`]: true,
  },
})
const expected = {
  [`${testDirectoryRelativeUrl}syntax-error.js`]: {
    ...actual[`${testDirectoryRelativeUrl}syntax-error.js`],
    s: {},
  },
}
assert({ actual, expected })
