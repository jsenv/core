import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { executeTestPlan, launchChromium } from "@jsenv/core"
import { EXECUTE_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TEST_PLAN.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}use-file.js`
const testPlan = {
  [fileRelativeUrl]: {
    browser: {
      launch: launchChromium,
    },
  },
}

executeTestPlan({
  ...EXECUTE_TEST_PARAMS,
  logLevel: "info",
  jsenvDirectoryRelativeUrl,
  testPlan,
  coverage: true,
  coverageConfig: {
    [`./${testDirectoryRelativeUrl}file.js`]: true,
  },
  coverageTextLog: true,
  coverageJsonFile: true,
  coverageJsonFileRelativeUrl: `${testDirectoryRelativeUrl}coverage/coverage.json`,
  coverageHtmlDirectory: true,
  coverageHtmlDirectoryRelativeUrl: `${testDirectoryRelativeUrl}coverage`,
})
