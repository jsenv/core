import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, urlToFileSystemPath } from "@jsenv/util"
import { fetchUrl } from "@jsenv/server"
import { require } from "../../../src/internal/require.js"
import { COMPILE_ID_COMMONJS_BUNDLE } from "../../../src/internal/CONSTANTS.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "../../../src/internal/compiling/startCompileServer.js"
import { jsenvBabelPluginMap } from "../../../src/jsenvBabelPluginMap.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const filename = `${testDirectoryname}.cjs`
const babelPluginMap = jsenvBabelPluginMap

const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  compileServerLogLevel: "error",
  projectDirectoryUrl: testDirectoryUrl,
  importMapFileRelativeUrl: "./test.importmap",
  jsenvDirectoryClean: true,
  babelPluginMap,
  env: {
    whatever: 42,
  },
})
const compiledFileRelativeUrl = `${outDirectoryRelativeUrl}${COMPILE_ID_COMMONJS_BUNDLE}/${filename}`
const compiledFileServerUrl = `${compileServerOrigin}/${compiledFileRelativeUrl}`
const compiledFileUrl = `${testDirectoryUrl}${compiledFileRelativeUrl}`
const { status, statusText, headers } = await fetchUrl(compiledFileServerUrl, {
  ignoreHttpsError: true,
})
{
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
{
  // eslint-disable-next-line import/no-dynamic-require
  const actual = require(urlToFileSystemPath(compiledFileUrl))
  const expected = 42
  assert({ actual, expected })
}
