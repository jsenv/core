import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { fetchUrl } from "@jsenv/server"

import { jsenvRuntimeSupportDuringDev } from "@jsenv/core/src/jsenvRuntimeSupportDuringDev.js"
import { COMPILE_ID_OTHERWISE } from "@jsenv/core/src/internal/CONSTANTS.js"
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
const filename = `main.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
// const fileUrl = resolveUrl(fileRelativeUrl, jsenvCoreDirectoryUrl)
const compiledFileRelativeUrl = `${jsenvDirectoryRelativeUrl}out/${COMPILE_ID_OTHERWISE}/${fileRelativeUrl}?t=1`
// const compiledFileUrl = `${jsenvCoreDirectoryUrl}${compiledFileRelativeUrl}`

const compileServer = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  runtimeSupport: jsenvRuntimeSupportDuringDev,
})
const fileServerUrl = `${compileServer.origin}/${compiledFileRelativeUrl}`
const response = await fetchUrl(fileServerUrl, {
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
