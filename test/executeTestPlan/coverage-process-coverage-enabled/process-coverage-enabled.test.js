import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { executeTestPlan, launchNode } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}file.js`

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
      runtimeName: "node",
      runtimeVersion: actual[fileRelativeUrl].node.runtimeVersion,
    },
  },
}
assert({ actual, expected })
