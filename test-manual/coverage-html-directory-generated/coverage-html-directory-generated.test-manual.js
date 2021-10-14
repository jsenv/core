import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"
import { executeTestPlan, chromiumRuntime } from "@jsenv/core"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}use-file.js`
const testPlan = {
  [fileRelativeUrl]: {
    browser: {
      runtime: chromiumRuntime,
    },
  },
}

executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
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
