import { assert } from "@jsenv/assert"
import { urlToFileSystemPath } from "@jsenv/util"
import { fetchUrl } from "@jsenv/server"
import { COMPILE_ID_COMMONJS_BUNDLE } from "internal/CONSTANTS.js"
import { startCompileServer } from "internal/compiling/startCompileServer.js"
import { jsenvBabelPluginMap } from "src/jsenvBabelPluginMap.js"

const testDirectoryUrl = import.meta.resolve("./")
const filename = `jsenv-core.js`
const babelPluginMap = jsenvBabelPluginMap
const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  compileServerLogLevel: "error",
  projectDirectoryUrl: testDirectoryUrl,
  jsenvDirectoryClean: true,
  babelPluginMap,
  env: {
    whatever: 42,
  },
})
const compiledFileRelativeUrl = `${outDirectoryRelativeUrl}${COMPILE_ID_COMMONJS_BUNDLE}/${filename}`
const compiledFileServerUrl = `${compileServerOrigin}/${compiledFileRelativeUrl}`
const compiledFileUrl = `${testDirectoryUrl}${compiledFileRelativeUrl}`
const response = await fetchUrl(compiledFileServerUrl)

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

{
  // eslint-disable-next-line import/no-dynamic-require
  const actual = require(urlToFileSystemPath(compiledFileUrl))
  const expected = 42
  assert({ actual, expected })
}
