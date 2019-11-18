import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, resolveFileUrl, urlToRelativePath } from "src/internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "../../../index.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS.js"
import { fetch } from "../fetch.js"

const compileDirectoryUrl = resolveDirectoryUrl("./.dist", import.meta.url)
const fileUrl = resolveFileUrl("./file.js", import.meta.url)
const fileRelativeUrl = urlToRelativePath(fileUrl, jsenvCoreDirectoryUrl)
const compileDirectoryRelativeUrl = urlToRelativePath(
  compileDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const compileServer = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  compileDirectoryUrl,
})
const fileServerUrl = `${compileServer.origin}/${compileDirectoryRelativeUrl}otherwise/${fileRelativeUrl}`

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
