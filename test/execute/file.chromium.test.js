import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { JSENV_PATH } from "../../src/JSENV_PATH.js"
import { execute, launchChromium } from "../../index.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const projectFolder = JSENV_PATH
const compileInto = `${folderJsenvRelativePath}/.dist`
const fileRelativePath = `${folderJsenvRelativePath}/file.js`

const actual = await execute({
  projectFolder,
  compileInto,
  launch: launchChromium,
  fileRelativePath,
  stopOnceExecuted: true,
})

assert({ actual, expected: { status: "completed" } })
