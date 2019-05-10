import { assert } from "@dmail/assert"
import { hrefToFolderJsenvRelative } from "../../../src/hrefToFolderJsenvRelative.js"
import { ROOT_FOLDER } from "../../../src/ROOT_FOLDER.js"
import { startCompileServer } from "../../../index.js"
import { fetch } from "../fetch.js"

const testFolderRelative = hrefToFolderJsenvRelative(import.meta.url)
const projectFolder = ROOT_FOLDER
const compileInto = `${testFolderRelative}/.dist`

const compileServer = await startCompileServer({
  projectFolder,
  compileInto,
  verbose: false,
})

const response = await fetch(
  `${compileServer.origin}/${compileInto}/otherwise/${testFolderRelative}/syntax-error.js`,
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
    messageHTML: actual.body.messageHTML,
    filename: `${projectFolder}/${testFolderRelative}/syntax-error.js`,
    outputFilename: `file://${projectFolder}/${compileInto}/otherwise/${testFolderRelative}/syntax-error.js`,
    lineNumber: 1,
    columnNumber: 11,
  },
}

assert({
  actual,
  expected,
})
