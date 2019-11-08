import { assert } from "@dmail/assert"
import { launchNode } from "@jsenv/node-launcher"
import { cover } from "../../../index.js"
import { fileHrefToFolderRelativePath } from "../../file-href-to-folder-relative-path.js"
import { COVERAGE_TEST_PARAM } from "../coverage-test-param.js"

const folderRelativePath = fileHrefToFolderRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderRelativePath}/.dist`

const {
  executionResult: { report: actual },
} = await cover({
  ...COVERAGE_TEST_PARAM,
  compileIntoRelativePath,
  measureDuration: false,
  captureConsole: false,
  collectNamespace: true,
  coverDescription: {},
  executeDescription: {
    [`${folderRelativePath}/file.js`]: {
      node: {
        launch: launchNode,
      },
    },
  },
})
const expected = {
  [`${folderRelativePath}/file.js`]: {
    node: {
      status: "completed",
      namespace: { COVERAGE_ENABLED: "true" },
      coverageMap: undefined,
      platformName: "node",
      platformVersion: actual[`${folderRelativePath}/file.js`].node.platformVersion,
    },
  },
}
assert({
  actual,
  expected,
})
