import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { fetchUrl } from "@jsenv/server"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { convertCommonJsWithBabel } from "@jsenv/core"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS_COMPILE_SERVER.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const filename = `${testDirectoryname}.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const compileId = "best"

const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  convertMap: {
    [fileRelativeUrl]: (options) =>
      convertCommonJsWithBabel({ ...options, processEnvNodeEnv: "production" }),
  },
})
const fileServerUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}${compileId}/${fileRelativeUrl}`
const { status, statusText, headers } = await fetchUrl(fileServerUrl, { ignoreHttpsError: true })
const actual = {
  status,
  statusText,
  contentType: headers.get("content-type"),
}
const expected = {
  status: 200,
  statusText: "OK",
  contentType: "application/javascript",
}
assert({ actual, expected })
