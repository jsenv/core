import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { fetchUrl } from "@jsenv/server"

import { importUsingChildProcess } from "@jsenv/core"
import { COMPILE_ID_OTHERWISE } from "@jsenv/core/src/internal/CONSTANTS.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../../TEST_PARAMS_COMPILE_SERVER.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const filename = `file.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
// const fileUrl = resolveUrl(fileRelativeUrl, jsenvCoreDirectoryUrl)

const { origin: compileServerOrigin, outDirectoryRelativeUrl } =
  await startCompileServer({
    ...COMPILE_SERVER_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    processEnvNodeEnv: "prod",
    runtimeSupport: {
      chrome: "94",
    },
  })
const compileDirectoryRelativeUrl = `${outDirectoryRelativeUrl}${COMPILE_ID_OTHERWISE}/`
const fileServerUrl = `${compileServerOrigin}/${compileDirectoryRelativeUrl}${fileRelativeUrl}`
await fetchUrl(fileServerUrl)

const actual = await importUsingChildProcess(
  `${jsenvCoreDirectoryUrl}/${compileDirectoryRelativeUrl}${fileRelativeUrl}`,
)
const expected = {
  NODE_ENV: "prod",
}
assert({ actual, expected })
