import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { executeTestPlan, launchNode } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}generator.spec.js`
const testPlan = {
  [fileRelativeUrl]: {
    node: {
      launch: launchNode,
    },
  },
}
const actual = await executeTestPlan({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  testPlan,
  compileGroupCount: 1,
})
const expected = {
  summary: {
    executionCount: 1,
    disconnectedCount: 0,
    timedoutCount: 0,
    erroredCount: 0,
    completedCount: 1,
    startMs: actual.summary.startMs,
    endMs: actual.summary.endMs,
  },
  report: {
    [fileRelativeUrl]: {
      node: {
        status: "completed",
        runtimeName: "node",
        runtimeVersion: actual.report[fileRelativeUrl].node.runtimeVersion,
      },
    },
  },
}
assert({ actual, expected })
