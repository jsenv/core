import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { fetchUrl } from "@jsenv/server"

import { startCompileServer } from "@jsenv/core/src/internal/compile_server/compile_server.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { jsenvRuntimeSupportDuringDev } from "@jsenv/core/src/jsenvRuntimeSupportDuringDev.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS_COMPILE_SERVER.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const fileRelativeUrl = `${testDirectoryRelativeUrl}file.jsx`
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`

// syntax error when syntax-jsx is not enabled
{
  const compileServer = await startCompileServer({
    ...COMPILE_SERVER_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    runtimeSupport: jsenvRuntimeSupportDuringDev,
    babelConfigFileUrl: undefined,
  })
  const { compileId } = await compileServer.createCompileIdFromRuntimeReport({})
  const compiledFileRelativeUrl = `${jsenvDirectoryRelativeUrl}${compileId}/${fileRelativeUrl}`
  const fileServerUrl = `${compileServer.origin}/${compiledFileRelativeUrl}`
  const response = await fetchUrl(fileServerUrl)
  const responseBodyAsJson = await response.json()

  const actual = {
    status: response.status,
    statusText: response.statusText,
    contentType: response.headers.get("content-type"),
    responseIncludesJsxNotEnabled: responseBodyAsJson.message.includes(
      `Support for the experimental syntax 'jsx' isn't currently enabled`,
    ),
  }
  const expected = {
    status: 500,
    statusText: "parse error",
    contentType: "application/json",
    responseIncludesJsxNotEnabled: true,
  }
  assert({ actual, expected })
}

// ok when syntax-jsx plugin is enabled
{
  const compileServer = await startCompileServer({
    ...COMPILE_SERVER_TEST_PARAMS,
    babelConfigFileUrl: new URL("./babel.config.cjs", import.meta.url),
    jsenvDirectoryRelativeUrl,
    runtimeSupport: jsenvRuntimeSupportDuringDev,
  })
  const { compileId } = await compileServer.createCompileIdFromRuntimeReport({})
  const compiledFileRelativeUrl = `${jsenvDirectoryRelativeUrl}${compileId}/${fileRelativeUrl}`
  const fileServerUrl = `${compileServer.origin}/${compiledFileRelativeUrl}`
  const response = await fetchUrl(fileServerUrl)

  const actual = {
    status: response.status,
    statusText: response.statusText,
    contentType: response.headers.get("content-type"),
  }
  const expected = {
    status: 200,
    statusText: "OK",
    contentType: "application/javascript",
  }
  assert({ actual, expected })
}
