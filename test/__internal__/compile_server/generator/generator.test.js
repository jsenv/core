import { fetchUrl } from "@jsenv/server"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compile_server/compile_server.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS_COMPILE_SERVER.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const fileRelativeUrl = `${testDirectoryRelativeUrl}generator.js`
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const compileServer = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})
const { compileId } = await compileServer.createCompileIdFromRuntimeReport({})
const fileServerUrl = `${compileServer.origin}/${compileServer.jsenvDirectoryRelativeUrl}${compileId}/${fileRelativeUrl}`
const { status, statusText, headers } = await fetchUrl(fileServerUrl, {
  ignoreHttpsError: true,
})
const actual = {
  status,
  statusText,
  contentType: headers.get("content-type"),
}
const expected = {
  status: 200,
  statusText: "OK",
  contentType: "application/javascript",
}
assert({ actual, expected })
