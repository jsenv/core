import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { executeTestPlan, launchNode } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativePath}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativePath}timeout.js`
const testPlan = {
  [fileRelativeUrl]: {
    node: {
      launch: (options) =>
        launchNode({
          ...options,
          env: { AWAIT_FOREVER: true },
        }),
      allocatedMs: 8000,
      allocatedMsBeforeForceStop: 1000,
    },
  },
}
const { coverageMap: actual } = await executeTestPlan({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  testPlan,
  coverage: true,
  coverageAndExecutionAllowed: true,
  coverageConfig: {
    [fileRelativeUrl]: true,
  },
})
const expected = {
  [fileRelativeUrl]: {
    ...actual[fileRelativeUrl],
    s: { 0: 0, 1: 0 },
  },
}
assert({ actual, expected })
