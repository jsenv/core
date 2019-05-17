import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { cover } from "../../../index.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const projectFolder = JSENV_PATH
const compileInto = `${folderJsenvRelativePath}/.dist`

const { coverageMap } = await cover({
  projectFolder,
  compileInto,
  coverDescription: {
    [`/${folderJsenvRelativePath}/file.js`]: true,
  },
  executeDescription: {},
  executionLogLevel: "off",
  writeCoverageFile: false,
})
assert({
  actual: coverageMap,
  expected: {
    [`${folderJsenvRelativePath}/file.js`]: {
      ...coverageMap[`${folderJsenvRelativePath}/file.js`],
      s: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
    },
  },
})
