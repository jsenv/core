import { assert } from "@dmail/assert"
import { launchNode } from "@jsenv/node-launcher"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { test } from "../../../index.js"
import { TESTING_TEST_PARAM } from "../testing-test-param.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`
const timeoutFileRelativePath = `${folderJsenvRelativePath}/timeout.js`
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
  planResult: {
    [timeoutFileRelativePath]: {
      node: {
        status: "timedout",
        platformName: "node",
        platformVersion: actual.planResult[timeoutFileRelativePath].node.platformVersion,
      },
    },
  },
  planResultSummary: {
    executionCount: 1,
    disconnectedCount: 0,
    timedoutCount: 1,
    erroredCount: 0,
    completedCount: 0,
  },
}
assert({ actual, expected })
