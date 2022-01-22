import { fetchUrl } from "@jsenv/server"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { jsenvRuntimeSupportDuringDev } from "@jsenv/core/src/jsenvRuntimeSupportDuringDev.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import {
  findHtmlNodeById,
  getHtmlNodeAttributeByName,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS_COMPILE_SERVER.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const fileRelativeUrl = `${testDirectoryRelativeUrl}main.html`
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`

const compileServer = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  runtimeSupport: jsenvRuntimeSupportDuringDev,
})
const { compileId } = await compileServer.createCompileIdFromRuntimeReport({
  env: { browser: true },
})
const compiledFileRelativeUrl = `${compileServer.jsenvDirectoryRelativeUrl}${compileId}/${fileRelativeUrl}?t=1`
const fileCompiledServerUrl = `${compileServer.origin}/${compiledFileRelativeUrl}`
const response = await fetchUrl(fileCompiledServerUrl, {
  ignoreHttpsError: true,
})
const responseBodyAsText = await response.text()
const script = findHtmlNodeById(responseBodyAsText, "module_script")
const scriptTypeAttribute = getHtmlNodeAttributeByName(script, "type")

const actual = {
  status: response.status,
  contentType: response.headers.get("content-type"),
  scriptTypeAttribute,
}
const expected = {
  status: 200,
  contentType: "text/html",
  scriptTypeAttribute: undefined,
}
assert({ actual, expected })
