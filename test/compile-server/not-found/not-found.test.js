import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { startCompileServer } from "../../../index.js"
import { COMPILE_SERVER_TEST_PARAM } from "../compile-server-test-param.js"
import { fetch } from "../fetch.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`
const compileId = "otherwise"
const fileRelativePath = `${folderJsenvRelativePath}/file.js`

const compileServer = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAM,
  compileIntoRelativePath,
})

const response = await fetch(
  `${compileServer.origin}${compileIntoRelativePath}/${compileId}${fileRelativePath}`,
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
