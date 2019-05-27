import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { cover, launchNode } from "../../../index.js"
import { COVERAGE_TEST_PARAM } from "../coverage-test-param.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`

const { planResult: actual } = await cover({
  ...COVERAGE_TEST_PARAM,
  compileIntoRelativePath,
  measureDuration: false,
  captureConsole: false,
  collectNamespace: true,
  coverDescription: {},
  executeDescription: {
    [`${folderJsenvRelativePath}/file.js`]: {
      node: {
        launch: launchNode,
      },
    },
  },
})
assert({
  actual,
  expected: {
    [`${folderJsenvRelativePath}/file.js`]: {
      node: {
        status: "completed",
        namespace: { COVERAGE_ENABLED: "true" },
        coverageMap: undefined,
        platformName: "node",
        platformVersion: actual[`${folderJsenvRelativePath}/file.js`].node.platformVersion,
      },
    },
  },
})
