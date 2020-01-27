import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { fetchUrl } from "@jsenv/server"
import { COMPILE_ID_OTHERWISE } from "../../../src/internal/CONSTANTS.js"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "../../../src/internal/compiling/startCompileServer.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const filename = `${testDirectoryname}.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`

const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})
const fileServerUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}${COMPILE_ID_OTHERWISE}/${fileRelativeUrl}`
const response = await fetchUrl(fileServerUrl)
const actual = {
  status: response.status,
  statusText: response.statusText,
  body: await response.text(),
}
const expected = {
  status: 404,
  statusText: "file not found",
  body: "",
}
assert({ actual, expected })
