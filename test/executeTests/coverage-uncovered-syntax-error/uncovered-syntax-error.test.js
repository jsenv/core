import { assert } from "@dmail/assert"
import { cover } from "../../../index.js"
import { fileHrefToFolderRelativePath } from "../../file-href-to-folder-relative-path.js"
import { COVERAGE_TEST_PARAM } from "../coverage-test-param.js"

const folderRelativePath = fileHrefToFolderRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderRelativePath}/.dist`
const { coverageMap: actual } = await cover({
  ...COVERAGE_TEST_PARAM,
  compileIntoRelativePath,
  executeDescription: {},
  coverDescription: {
    [`${folderRelativePath}/syntax-error.js`]: true,
  },
})
const expected = {
  [`${folderRelativePath.slice(1)}/syntax-error.js`]: {
    ...actual[`${folderRelativePath.slice(1)}/syntax-error.js`],
    s: {},
  },
}
assert({
  actual,
  expected,
})
