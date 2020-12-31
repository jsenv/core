import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { fetchUrl } from "@jsenv/server"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { jsenvBrowserSystemRelativeUrl } from "@jsenv/core/src/internal/jsenvInternalFiles.js"
import { COMPILE_ID_BUILD_GLOBAL } from "@jsenv/core/src/internal/CONSTANTS.js"
import { COMPILE_SERVER_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"

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
const fileServerUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}${COMPILE_ID_BUILD_GLOBAL}/${jsenvBrowserSystemRelativeUrl}`
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
