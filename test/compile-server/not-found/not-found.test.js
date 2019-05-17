import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { startCompileServer } from "../../../index.js"
import { fetch } from "../fetch.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const projectFolder = JSENV_PATH
const compileInto = `${folderJsenvRelativePath}/.dist`

const compileServer = await startCompileServer({
  projectFolder,
  compileInto,
  logLevel: "off",
})

const response = await fetch(
  `${compileServer.origin}/${compileInto}/otherwise/${folderJsenvRelativePath}/file.js`,
)
const body = await response.text()
const actual = {
  status: response.status,
  statusText: response.statusText,
  headers: response.headers,
  body,
}
const expected = {
  status: 404,
  statusText: "file not found",
  headers: actual.headers,
  body: "",
}
assert({ actual, expected })
