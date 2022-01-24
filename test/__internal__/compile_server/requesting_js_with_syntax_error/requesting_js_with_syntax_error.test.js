import { fetchUrl } from "@jsenv/server"
import {
  resolveUrl,
  urlToRelativeUrl,
  urlToFileSystemPath,
} from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS_COMPILE_SERVER.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const fileRelativeUrl = `${testDirectoryRelativeUrl}syntax_error.js`
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const compileServer = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})
const { compileId } = await compileServer.createCompileIdFromRuntimeReport({})
const fileCompiledServerUrl = `${compileServer.origin}/${compileServer.jsenvDirectoryRelativeUrl}${compileId}/${fileRelativeUrl}`
const response = await fetchUrl(fileCompiledServerUrl, {
  ignoreHttpsError: true,
})

const actual = {
  status: response.status,
  statusText: response.statusText,
  contentType: response.headers.get("content-type"),
  cacheControl: response.headers.get("cache-control"),
  body: await response.json(),
}
const expected = {
  status: 500,
  statusText: "parse error",
  contentType: "application/json",
  cacheControl: "no-store",
  body: {
    message: actual.body.message,
    messageHTML: actual.body.messageHTML,
    filename: urlToFileSystemPath(
      resolveUrl(fileRelativeUrl, jsenvCoreDirectoryUrl),
    ),
    lineNumber: 1,
    columnNumber: 11,
  },
}
assert({ actual, expected })
