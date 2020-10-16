import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { fetchUrl } from "@jsenv/server"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "../../../src/internal/compiling/startCompileServer.js"
import { browserJsFileUrl } from "../../../src/internal/jsenvInternalFiles.js"
import { COMPILE_ID_GLOBAL_BUNDLE } from "../../../src/internal/CONSTANTS.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const projectDirectoryUrl = jsenvCoreDirectoryUrl
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`

const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  // compileServerLogLevel: "warn",
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
})
const browserJsFileRelativeUrl = urlToRelativeUrl(browserJsFileUrl, jsenvCoreDirectoryUrl)
const fileServerUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}${COMPILE_ID_GLOBAL_BUNDLE}/${browserJsFileRelativeUrl}`
const { url, status, statusText, headers } = await fetchUrl(fileServerUrl, {
  ignoreHttpsError: true,
})
const actual = {
  url,
  status,
  statusText,
  contentType: headers.get("content-type"),
}
const expected = {
  url,
  status: 200,
  statusText: "OK",
  contentType: "application/javascript",
}
assert({ actual, expected })
