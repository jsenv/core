import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { fetchUrl } from "@jsenv/server"
import { COMPILE_ID_OTHERWISE } from "../../../src/internal/CONSTANTS.js"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "../../../src/internal/compiling/startCompileServer.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativePath)
const filename = `${testDirectoryname}.js`
const fileRelativeUrl = `${testDirectoryRelativePath}${filename}`
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativePath}.jsenv/`
const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})

const fileServerUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}${COMPILE_ID_OTHERWISE}/${fileRelativeUrl}`
const response = await fetchUrl(fileServerUrl)
{
  const { status, statusText, headers } = response
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
}
// test the cache now
{
  const { status, statusText } = await fetchUrl(fileServerUrl, {
    headers: {
      "if-none-match": response.headers.get("etag"),
    },
  })
  const actual = {
    status,
    statusText,
  }
  const expected = {
    status: 304,
    statusText: "Not Modified",
  }
  assert({ actual, expected })
}
