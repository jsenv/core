import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, urlToFileSystemPath } from "@jsenv/util"
import { fetchUrl } from "@jsenv/server"
import { require } from "../../../src/internal/require.js"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "../../../src/internal/compiling/startCompileServer.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`

;(async () => {
  const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
    ...COMPILE_SERVER_TEST_PARAMS,
    compileServerLogLevel: "warn",
    jsenvDirectoryRelativeUrl,
  })
  const compiledFileRelativeUrl = `${outDirectoryRelativeUrl}otherwise-commonjs-bundle/src/nodePlatform.js`
  const fileServerUrl = `${compileServerOrigin}/${compiledFileRelativeUrl}`
  const { url, status, statusText, headers } = await fetchUrl(fileServerUrl, {
    ignoreHttpsError: true,
  })
  {
    const actual = {
      url,
      status,
      statusText,
      contentType: headers.get("content-type"),
    }
    const expected = {
      url,
      status: 200,
      statusText: "OK",
      contentType: "application/javascript",
    }
    assert({ actual, expected })
  }
  {
    const compiledFileUrl = resolveUrl(
      "./.jsenv/out/otherwise-commonjs-bundle/src/nodePlatform.js",
      testDirectoryUrl,
    )

    // note the require below would fail on node 13+
    // (but we would not build a node platform file in that case)
    // eslint-disable-next-line import/no-dynamic-require
    const { nodePlatform } = require(urlToFileSystemPath(compiledFileUrl))
    const actual = typeof nodePlatform.create
    const expected = "function"
    assert({ actual, expected })
  }
})()
