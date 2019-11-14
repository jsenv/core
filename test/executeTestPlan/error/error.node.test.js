import { assert } from "@jsenv/assert"
import { launchNode } from "@jsenv/node-launcher"
import { fileHrefToFolderRelativePath } from "../../file-href-to-folder-relative-path.js"
import { test } from "../../../index.js"
import { TESTING_TEST_PARAM } from "../testing-test-param.js"

const folderRelativePath = fileHrefToFolderRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderRelativePath}/.dist`
const fileRelativePath = `${folderRelativePath}/file.spec.js`
const executeDescription = {
  [fileRelativePath]: {
    node: {
      launch: launchNode,
    },
  },
}

const actual = await test({
  ...TESTING_TEST_PARAM,
  compileIntoRelativePath,
  executeDescription,
  captureConsole: true,
})
const expected = {
  summary: {
    executionCount: 1,
    disconnectedCount: 0,
    timedoutCount: 0,
    erroredCount: 1,
    completedCount: 0,
  },
  report: {
    [fileRelativePath]: {
      node: {
        status: "errored",
        error: new Error(`ask() should return 42, got 40`),
        platformLog: actual.report[fileRelativePath].node.platformLog,
        platformName: "node",
        platformVersion: actual.report[fileRelativePath].node.platformVersion,
      },
    },
  },
}
assert({ actual, expected })

{
  // error should not be in logs
  const actual = actual.report[fileRelativePath].node.platformLog.includes(`should return 42`)
  const expected = false
  assert({ actual, expected })
}
