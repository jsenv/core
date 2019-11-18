import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativePath } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { executeTestPlan, launchNode } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativePath(testDirectoryUrl, jsenvCoreDirectoryUrl)
const compileDirectoryRelativeUrl = `${testDirectoryRelativePath}.dist/`
const fileRelativeUrl = `${testDirectoryRelativePath}file.js`
const testPlan = {
  [fileRelativeUrl]: {
    node: {
      launch: launchNode,
    },
    node2: {
      launch: launchNode,
    },
  },
}

const actual = await executeTestPlan({
  ...EXECUTE_TEST_PARAMS,
  compileDirectoryRelativeUrl,
  testPlan,
  compileGroupCount: 1,
})
const expected = {
  summary: {
    executionCount: 2,
    disconnectedCount: 0,
    timedoutCount: 0,
    erroredCount: 0,
    completedCount: 2,
  },
  report: {
    [fileRelativeUrl]: {
      node: {
        status: "completed",
        namespace: {
          default: "node",
        },
        platformName: "node",
        platformVersion: actual.report[fileRelativeUrl].node.platformVersion,
      },
      node2: {
        status: "completed",
        namespace: {
          default: "node",
        },
        platformName: "node",
        platformVersion: actual.report[fileRelativeUrl].node.platformVersion,
      },
    },
  },
}
assert({ actual, expected })
