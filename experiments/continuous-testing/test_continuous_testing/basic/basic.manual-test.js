import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { nodeRuntime, chromiumRuntime } from "@jsenv/core"
import { startContinuousTesting } from "@jsenv/core/experimental/continuous-testing/startContinuousTesting.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { CONTINUOUS_TESTING_TEST_PARAM } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`

const testPlan = {
  [`${testDirectoryRelativeUrl}/*.spec.js`]: {
    node: {
      runtime: nodeRuntime,
    },
    chromium: {
      runtime: chromiumRuntime,
    },
  },
}

await startContinuousTesting({
  ...CONTINUOUS_TESTING_TEST_PARAM,
  jsenvDirectoryRelativeUrl,
  defaultAllocatedMsPerExecution: Infinity,
  testPlan,
})
