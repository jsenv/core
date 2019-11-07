import { assert } from "@dmail/assert"
// import { launchChromium } from "@jsenv/chromium-launcher"
import { resolveDirectoryUrl, fileUrlToRelativePath } from "src/private/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "src/private/jsenvCoreDirectoryUrl.js"
import { executeTests, launchNode } from "../../../index.js"
import { EXECUTE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = fileUrlToRelativePath(testDirectoryUrl, jsenvCoreDirectoryUrl)
const compileDirectoryRelativePath = `${testDirectoryRelativePath}.dist/`
const fileRelativePath = `${testDirectoryRelativePath}file.js`

const executionConfig = {
  [fileRelativePath]: {
    node: {
      launch: launchNode,
    },
    // chromium: {
    //   launch: launchChromium,
    // },
  },
}

const actual = await executeTests({
  ...EXECUTE_TEST_PARAMS,
  compileDirectoryRelativePath,
  executionConfig,
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
      // chromium: {
      //   status: "completed",
      //   namespace: {
      //     default: "browser",
      //   },
      //   platformName: "chromium",
      //   platformVersion: "78.0.3882.0",
      // },
    },
  },
}
assert({ actual, expected })
