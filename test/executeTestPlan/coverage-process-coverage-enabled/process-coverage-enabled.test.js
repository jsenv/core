import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { executeTestPlan, launchNode } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativePath}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativePath}file.js`

const { report: actual } = await executeTestPlan({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  testPlan: {
    [fileRelativeUrl]: {
      node: {
        launch: launchNode,
      },
    },
  },
  coverage: true,
  coverageConfig: {},
})
const expected = {
  [fileRelativeUrl]: {
    node: {
      status: "completed",
      namespace: { COVERAGE_ENABLED: "true" },
      coverageMap: undefined,
      platformName: "node",
      platformVersion: actual[fileRelativeUrl].node.platformVersion,
    },
  },
}
assert({ actual, expected })
