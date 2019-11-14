import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, fileUrlToRelativePath } from "src/internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "src/internal/jsenvCoreDirectoryUrl.js"
import { executeTestPlan, launchNode } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = fileUrlToRelativePath(testDirectoryUrl, jsenvCoreDirectoryUrl)
const compileDirectoryRelativePath = `${testDirectoryRelativePath}.dist/`
const fileRelativePath = `${testDirectoryRelativePath}file.js`

const testPlan = {
  [fileRelativePath]: {
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
  compileDirectoryRelativePath,
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
    [fileRelativePath]: {
      node: {
        status: "completed",
        namespace: {
          default: "node",
        },
        platformName: "node",
        platformVersion: actual.report[fileRelativePath].node.platformVersion,
      },
      node2: {
        status: "completed",
        namespace: {
          default: "node",
        },
        platformName: "node",
        platformVersion: actual.report[fileRelativePath].node.platformVersion,
      },
    },
  },
}
assert({ actual, expected })
