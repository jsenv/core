import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl, urlToFileSystemPath, resolveUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "internal/compiling/startCompileServer.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS.js"
import { fetch } from "../../fetch.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativePath)
const filename = `${testDirectoryname}.js`
const fileRelativeUrl = `${testDirectoryRelativePath}${filename}`
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativePath}.jsenv/`
const compileId = "otherwise"
const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})
const fileServerUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}${compileId}/${fileRelativeUrl}`
const response = await fetch(fileServerUrl)

const actual = {
  status: response.status,
  statusText: response.statusText,
  headers: response.headers,
  body: await response.json(),
}
const expected = {
  status: 500,
  statusText: "parse error",
  headers: {
    ...actual.headers,
    "cache-control": ["no-store"],
    "content-type": ["application/json"],
  },
  body: {
    message: actual.body.message,
    messageHTML: actual.body.messageHTML,
    filename: urlToFileSystemPath(resolveUrl(fileRelativeUrl, jsenvCoreDirectoryUrl)),
    lineNumber: 1,
    columnNumber: 11,
  },
}
assert({ actual, expected })
