import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { cover, launchNode } from "../../../index.js"
import { COVERAGE_TEST_PARAM } from "../coverage-test-param.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`

const { coverageMap } = await cover({
  ...COVERAGE_TEST_PARAM,
  compileIntoRelativePath,
  executeDescription: {
    [`${folderJsenvRelativePath}/file.js`]: {
      node: {
        launch: launchNode,
      },
    },
  },
  generateMissedCoverage: false,
})
assert({
  actual: Object.keys(coverageMap).includes("src/node-platform-service/node-platform/index.js"),
  expected: true,
})
