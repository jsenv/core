import { assert } from "@jsenv/assert"
import { launchNode } from "@jsenv/node-launcher"
import { fileHrefToFolderRelativePath } from "../../file-href-to-folder-relative-path.js"
import { test } from "../../../index.js"
import { TESTING_TEST_PARAM } from "../testing-test-param.js"

const folderRelativePath = fileHrefToFolderRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderRelativePath}/.dist`
const timeoutFileRelativePath = `${folderRelativePath}/timeout.js`
const executeDescription = {
  [timeoutFileRelativePath]: {
    node: {
      launch: (options) =>
        launchNode({
          ...options,
          env: { AWAIT_FOREVER: true },
        }),
    },
  },
}

const actual = await test({
  ...TESTING_TEST_PARAM,
  compileIntoRelativePath,
  executeDescription,
  defaultAllocatedMsPerExecution: 10000,
})
const expected = {
  summary: {
    executionCount: 1,
    disconnectedCount: 0,
    timedoutCount: 1,
    erroredCount: 0,
    completedCount: 0,
  },
  report: {
    [timeoutFileRelativePath]: {
      node: {
        status: "timedout",
        platformName: "node",
        platformVersion: actual.report[timeoutFileRelativePath].node.platformVersion,
      },
    },
  },
}
assert({ actual, expected })
