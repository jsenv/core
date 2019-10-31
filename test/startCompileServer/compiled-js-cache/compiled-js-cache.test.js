import { assert } from "@dmail/assert"
import { resolveDirectoryUrl, resolveFileUrl, fileUrlToRelativePath } from "src/private/urlUtils.js"
import { startCompileServer } from "../../../index.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS.js"
import { fetch } from "../fetch.js"

const compileDirectoryUrl = resolveDirectoryUrl("./.dist", import.meta.url)
const fileUrl = resolveFileUrl("./file.js", import.meta.url)
const fileRelativePath = fileUrlToRelativePath(
  fileUrl,
  COMPILE_SERVER_TEST_PARAMS.projectDirectoryUrl,
)
const compileDirectoryRelativePath = fileUrlToRelativePath(
  compileDirectoryUrl,
  COMPILE_SERVER_TEST_PARAMS.projectDirectoryUrl,
)
const compileServer = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  compileDirectoryUrl,
})
const fileServerUrl = `${compileServer.origin}/${compileDirectoryRelativePath}otherwise/${fileRelativePath}`

const firstResponse = await fetch(fileServerUrl)
const secondResponse = await fetch(fileServerUrl, {
  headers: {
    "if-none-match": firstResponse.headers.etag[0],
  },
})
const actual = {
  status: secondResponse.status,
  statusText: secondResponse.statusText,
  headers: secondResponse.headers,
}
const expected = {
  status: 304,
  statusText: "Not Modified",
  headers: actual.headers,
}
assert({ actual, expected })
