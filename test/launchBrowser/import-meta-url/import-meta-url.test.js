import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { launchAndExecute } from "@jsenv/core/src/internal/executing/launchAndExecute.js"
import { launchChromium, launchFirefox, launchWebkit } from "@jsenv/core"
import { launchBrowsers } from "../launchBrowsers.js"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  EXECUTION_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const htmlFilename = `${testDirectoryBasename}.html`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}${htmlFilename}`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryBasename}.js`
const compileId = "otherwise"
const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...START_COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  compileGroupCount: 1, // ensure compileId always otherwise
})

await launchBrowsers([launchChromium, launchFirefox, launchWebkit], async (launchBrowser) => {
  const actual = await launchAndExecute({
    ...EXECUTION_TEST_PARAMS,
    fileRelativeUrl: htmlFileRelativeUrl,
    launch: (options) =>
      launchBrowser({
        ...LAUNCH_TEST_PARAMS,
        ...options,
        outDirectoryRelativeUrl,
        compileServerOrigin,
      }),
  })
  const expected = {
    status: "completed",
    namespace: {
      "./import-meta-url.js": {
        status: "completed",
        namespace: {
          default: `${compileServerOrigin}/${outDirectoryRelativeUrl}${compileId}/${fileRelativeUrl}`,
        },
      },
    },
  }
  assert({ actual, expected })
})
