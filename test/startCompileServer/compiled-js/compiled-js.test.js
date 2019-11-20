import { assert } from "@jsenv/assert"
import { COMPILE_DIRECTORY, COMPILE_ID_OTHERWISE } from "internal/CONSTANTS.js"
import { resolveDirectoryUrl, resolveFileUrl, urlToRelativeUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "internal/compiling/startCompileServer.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS.js"
import { fetch } from "../fetch.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const projectDirectoryUrl = jsenvCoreDirectoryUrl
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const compileDirectoryRelativeUrl = `${jsenvDirectoryRelativeUrl}${COMPILE_DIRECTORY}/`
const fileUrl = resolveFileUrl("./file.js", import.meta.url)
const fileRelativeUrl = urlToRelativeUrl(fileUrl, projectDirectoryUrl)
const compileServer = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
})
const fileServerUrl = `${compileServer.origin}/${compileDirectoryRelativeUrl}${COMPILE_ID_OTHERWISE}/${fileRelativeUrl}`
const response = await fetch(fileServerUrl)
const actual = {
  status: response.status,
  statusText: response.statusText,
  headers: response.headers,
}
const expected = {
  status: 200,
  statusText: "OK",
  headers: {
    ...actual.headers,
    "content-type": ["application/javascript"],
  },
}
assert({ actual, expected })
