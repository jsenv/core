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
const fileRelativeUrl = `${testDirectoryRelativeUrl}not_found.js`
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const compileServer = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})
const { compileId } = await compileServer.createCompileIdFromRuntimeReport({})
const fileCompiledServerUrl = `${compileServer.origin}/${compileServer.jsenvDirectoryRelativeUrl}${compileId}/${fileRelativeUrl}`
const fileUrl = resolveUrl(fileRelativeUrl, jsenvCoreDirectoryUrl)
const response = await fetchUrl(fileCompiledServerUrl, {
  ignoreHttpsError: true,
})
const actual = {
  status: response.status,
  statusText: response.statusText,
  body: await response.text(),
}
const expected = {
  status: 404,
  statusText: `ENOENT: File not found at ${urlToFileSystemPath(fileUrl)}`,
  body: "",
}
assert({ actual, expected })
