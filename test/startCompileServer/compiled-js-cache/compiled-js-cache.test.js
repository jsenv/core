import { assert } from "@jsenv/assert"
import { COMPILE_DIRECTORY, COMPILE_ID_OTHERWISE } from "internal/CONSTANTS.js"
import { resolveDirectoryUrl, resolveUrl, urlToRelativeUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "internal/compiling/startCompileServer.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS.js"
import { fetch } from "../fetch.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const projectDirectoryUrl = jsenvCoreDirectoryUrl
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const compileDirectoryRelativeUrl = `${jsenvDirectoryRelativeUrl}${COMPILE_DIRECTORY}/`
const fileUrl = resolveUrl("./file.js", import.meta.url)
const fileRelativeUrl = urlToRelativeUrl(fileUrl, projectDirectoryUrl)
const compileServer = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
})
const fileServerUrl = `${compileServer.origin}/${compileDirectoryRelativeUrl}${COMPILE_ID_OTHERWISE}/${fileRelativeUrl}`
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
