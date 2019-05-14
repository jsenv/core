import { assert } from "@dmail/assert"
import { hrefToFolderJsenvRelative } from "../../../src/hrefToFolderJsenvRelative.js"
import { ROOT_FOLDER } from "../../../src/ROOT_FOLDER.js"
import { cover } from "../../../index.js"

const testFolderRelative = hrefToFolderJsenvRelative(import.meta.url)
const projectFolder = ROOT_FOLDER
const compileInto = `${testFolderRelative}/.dist`

const { coverageMap } = await cover({
  projectFolder,
  compileInto,
  coverDescription: {
    [`/${testFolderRelative}/file.js`]: true,
  },
  executeDescription: {},
  executionLogLevel: "off",
  writeCoverageFile: false,
})
assert({
  actual: coverageMap,
  expected: {
    [`${testFolderRelative}/file.js`]: {
      ...coverageMap[`${testFolderRelative}/file.js`],
      s: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
    },
  },
})
