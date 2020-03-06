import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { executeTestPlan, launchChromium } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

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
  coverageJsonFileRelativeUrl: `${testDirectoryRelativeUrl}coverage/coverage-final.json`,
  coverageHtmlDirectory: true,
  coverageHtmlDirectoryRelativeUrl: `${testDirectoryRelativeUrl}coverage`,
})
