import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, urlToFileSystemPath } from "@jsenv/util"
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
const response = await fetchUrl(fileServerUrl, { ignoreHttpsError: true })
const actual = {
  status: response.status,
  statusText: response.statusText,
  contentType: response.headers.get("content-type"),
  cacheControl: response.headers.get("cache-control"),
  body: await response.json(),
}
const expected = {
  status: 500,
  statusText: "parse error",
  contentType: "application/json",
  cacheControl: "no-store",
  body: {
    message: actual.body.message,
    messageHTML: actual.body.messageHTML,
    filename: urlToFileSystemPath(resolveUrl(fileRelativeUrl, jsenvCoreDirectoryUrl)),
    lineNumber: 1,
    columnNumber: 11,
  },
}
assert({ actual, expected })
