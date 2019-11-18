import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, resolveFileUrl, urlToRelativeUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "internal/compiling/startCompileServer.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS.js"
import { fetch } from "../fetch.js"

const compileDirectoryUrl = resolveDirectoryUrl("./.dist", import.meta.url)
const fileUrl = resolveFileUrl("./file.js", import.meta.url)
const fileRelativeUrl = urlToRelativeUrl(fileUrl, COMPILE_SERVER_TEST_PARAMS.projectDirectoryUrl)
const compileDirectoryRelativeUrl = urlToRelativeUrl(compileDirectoryUrl, jsenvCoreDirectoryUrl)
const compileServer = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  compileDirectoryUrl,
})
const fileServerUrl = `${compileServer.origin}/${compileDirectoryRelativeUrl}otherwise/${fileRelativeUrl}`

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
