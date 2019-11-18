import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, resolveFileUrl, urlToRelativePath } from "src/internal/urlUtils.js"
import { startCompileServer } from "../../../index.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS.js"
import { fetch } from "../fetch.js"

const compileDirectoryUrl = resolveDirectoryUrl("./.dist", import.meta.url)
const fileUrl = resolveFileUrl("./file.js", import.meta.url)
const fileRelativeUrl = urlToRelativePath(
  fileUrl,
  COMPILE_SERVER_TEST_PARAMS.projectDirectoryUrl,
)
const compileServer = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  compileDirectoryUrl,
})
const fileServerUrl = `${compileServer.origin}/.dist/otherwise/${fileRelativeUrl}`
const response = await fetch(fileServerUrl)
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
