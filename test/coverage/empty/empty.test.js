import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { cover } from "../../../index.js"
import { COVERAGE_TEST_PARAM } from "../coverage-test-param.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`

const { coverageMap } = await cover({
  ...COVERAGE_TEST_PARAM,
  compileIntoRelativePath,
  coverDescription: {
    [`${folderJsenvRelativePath}/file.js`]: true,
  },
  executeDescription: {},
})
assert({
  actual: coverageMap,
  expected: {
    [`${folderJsenvRelativePath.slice(1)}/file.js`]: {
      ...coverageMap[`${folderJsenvRelativePath.slice(1)}/file.js`],
      s: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
    },
  },
})
