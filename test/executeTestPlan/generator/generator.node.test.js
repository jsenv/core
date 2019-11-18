import { assert } from "@jsenv/assert"
import { launchNode } from "@jsenv/node-launcher"
import { fileHrefToFolderRelativePath } from "../../file-href-to-folder-relative-path.js"
import { test } from "../../../index.js"
import { TESTING_TEST_PARAM } from "../testing-test-param.js"

const folderRelativePath = fileHrefToFolderRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderRelativePath}/.dist`
const fileRelativeUrl = `${folderRelativePath}/generator.spec.js`
const executeDescription = {
  [fileRelativeUrl]: {
    node: {
      launch: launchNode,
    },
  },
}

const actual = await test({
  ...TESTING_TEST_PARAM,
  compileIntoRelativePath,
  executeDescription,
  collectNamespace: false,
})
const expected = {
  summary: {
    executionCount: 1,
    disconnectedCount: 0,
    timedoutCount: 0,
    erroredCount: 0,
    completedCount: 1,
  },
  report: {
    [fileRelativeUrl]: {
      node: {
        status: "completed",
        platformName: "node",
        platformVersion: actual.report[fileRelativeUrl].node.platformVersion,
      },
    },
  },
}
assert({ actual, expected })
