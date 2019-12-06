import { assert } from "@jsenv/assert"
import { COMPILE_ID_COMMONJS_BUNDLE } from "internal/CONSTANTS.js"
import { urlToFilePath } from "internal/urlUtils.js"
import { startCompileServer } from "internal/compiling/startCompileServer.js"
import { jsenvBabelPluginMap } from "src/jsenvBabelPluginMap.js"
import { fetch } from "../../fetch.js"

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
const response = await fetch(compiledFileServerUrl)

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
  const actual = import.meta.require(urlToFilePath(compiledFileUrl))
  const expected = 42
  assert({ actual, expected })
}
