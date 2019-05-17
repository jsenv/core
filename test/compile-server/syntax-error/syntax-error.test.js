import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { startCompileServer } from "../../../index.js"
import { fetch } from "../fetch.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const projectFolder = JSENV_PATH
const compileInto = `${folderJsenvRelativePath}/.dist`
const compileId = "otherwise"

const compileServer = await startCompileServer({
  projectFolder,
  compileInto,
  logLevel: "off",
})

const response = await fetch(
  `${compileServer.origin}/${compileInto}/${compileId}/${folderJsenvRelativePath}/syntax-error.js`,
)
const body = await response.json()
const actual = {
  status: response.status,
  statusText: response.statusText,
  headers: response.headers,
  body,
}
const expected = {
  status: 500,
  statusText: "parse error",
  headers: {
    ...actual.headers,
    "cache-control": ["no-store"],
    "content-type": ["application/json"],
  },
  body: {
    message: actual.body.message,
    messageHTML: actual.body.messageHTML,
    filename: `${projectFolder}/${folderJsenvRelativePath}/syntax-error.js`,
    outputFilename: `file://${projectFolder}/${compileInto}/${compileId}/${folderJsenvRelativePath}/syntax-error.js`,
    lineNumber: 1,
    columnNumber: 11,
  },
}

assert({
  actual,
  expected,
})
