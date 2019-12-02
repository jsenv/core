import { assert } from "@jsenv/assert"
import { COMPILE_ID_OTHERWISE } from "internal/CONSTANTS.js"
import { resolveDirectoryUrl, resolveUrl, urlToRelativeUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "internal/compiling/startCompileServer.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS.js"
import { fetch } from "../fetch.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const projectDirectoryUrl = jsenvCoreDirectoryUrl
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileUrl = resolveUrl("./file.js", import.meta.url)
const fileRelativeUrl = urlToRelativeUrl(fileUrl, projectDirectoryUrl)
const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
})
const fileServerUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}${COMPILE_ID_OTHERWISE}/${fileRelativeUrl}`
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
