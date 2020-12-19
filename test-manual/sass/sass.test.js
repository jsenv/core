import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, urlToBasename } from "@jsenv/util"
import { fetchUrl } from "@jsenv/server"
import { COMPILE_ID_OTHERWISE } from "@jsenv/core/src/internal/CONSTANTS.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { COMPILE_SERVER_TEST_PARAMS } from "@jsenv/core/test/startCompileServer/TEST_PARAMS.js"
import { jsenvCompilerForSass } from "./jsenvCompilerForSass.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl.slice(0, -1))
const filename = `${testDirectoryname}.scss`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
// const fileUrl = resolveUrl(fileRelativeUrl, jsenvCoreDirectoryUrl)
const compiledFileRelativeUrl = `${jsenvDirectoryRelativeUrl}out/${COMPILE_ID_OTHERWISE}/${fileRelativeUrl}`
// const compiledFileUrl = `${jsenvCoreDirectoryUrl}${compiledFileRelativeUrl}`

{
  const { origin: compileServerOrigin } = await startCompileServer({
    ...COMPILE_SERVER_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    customCompilers: [jsenvCompilerForSass],
  })
  const fileServerUrl = `${compileServerOrigin}/${compiledFileRelativeUrl}`
  const response = await fetchUrl(fileServerUrl, { ignoreHttpsError: true })
  {
    const actual = {
      status: response.status,
      contentType: response.headers.get("content-type"),
      text: await response.text(),
    }
    const expected = {
      status: 200,
      contentType: "text/css",
      text: "",
    }
    assert({ actual, expected })
  }
}
