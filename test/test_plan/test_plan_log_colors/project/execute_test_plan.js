import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { executeTestPlan, nodeRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const testFileRelativeUrl = `${testDirectoryRelativeUrl}file.js`
const testPlan = {
  [testFileRelativeUrl]: {
    node: {
      runtime: nodeRuntime,
    },
  },
}

await executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
  logLevel: "info",
  jsenvDirectoryRelativeUrl,
  testPlan,
})
