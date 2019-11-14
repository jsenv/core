import { assert } from "@jsenv/assert"
import { cover } from "../../../index.js"
import { fileHrefToFolderRelativePath } from "../../file-href-to-folder-relative-path.js"
import { COVERAGE_TEST_PARAM } from "../coverage-test-param.js"

const folderRelativePath = fileHrefToFolderRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderRelativePath}/.dist`
const { coverageMap } = await cover({
  ...COVERAGE_TEST_PARAM,
  compileIntoRelativePath,
  coverDescription: {
    [`${folderRelativePath}/file.js`]: true,
  },
  executeDescription: {},
})
assert({
  actual: coverageMap,
  expected: {
    [`${folderRelativePath.slice(1)}/file.js`]: {
      ...coverageMap[`${folderRelativePath.slice(1)}/file.js`],
      s: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
    },
  },
})
