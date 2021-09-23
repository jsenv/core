import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, urlToBasename } from "@jsenv/filesystem"
import { fetchUrl } from "@jsenv/server"

import { jsenvRuntimeSupportDuringDev } from "@jsenv/core/src/jsenvRuntimeSupportDuringDev.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS_COMPILE_SERVER.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const filename = `${testDirectoryname}.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const { origin: compileServerOrigin } = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  compileCacheStrategy: "etag",
  runtimeSupport: jsenvRuntimeSupportDuringDev,
})

const fileServerUrl = `${compileServerOrigin}/${fileRelativeUrl}`
const response = await fetchUrl(fileServerUrl, {
  ignoreHttpsError: true,
})

const actual = {
  redirected: response.redirected,
  status: response.status,
  statusText: response.statusText,
  contentType: response.headers.get("content-type"),
  responseBodyAsText: await response.text(),
}
const expected = {
  redirected: false,
  status: 200,
  statusText: "OK",
  contentType: "application/javascript",
  responseBodyAsText: `const a = true
console.log(a)
`,
}
assert({ actual, expected })
