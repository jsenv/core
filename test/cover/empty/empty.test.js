import { assert } from "@dmail/assert"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { cover } from "../../../index.js"

const projectPath = JSENV_PATH
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`

const { coverageMap } = await cover({
  projectPath,
  compileIntoRelativePath,
  coverDescription: {
    [`${folderJsenvRelativePath}/file.js`]: true,
  },
  executeDescription: {},
  executionLogLevel: "off",
  writeCoverageFile: false,
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
