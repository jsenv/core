import { assert } from "@jsenv/assert"
import { resolveUrl, resolveDirectoryUrl, urlToRelativeUrl, urlToBasename } from "@jsenv/filesystem"

import { launchChromium, launchFirefox, launchWebkit } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { launchAndExecute } from "@jsenv/core/src/internal/executing/launchAndExecute.js"
import { launchBrowsers } from "@jsenv/core/test/launchBrowsers.js"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  EXECUTION_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_BROWSER.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const htmlFilename = `${testDirectoryname}.html`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}${htmlFilename}`
const importerFileRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryname}.js`
const compileId = "otherwise"
const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...START_COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  compileGroupCount: 1, // force otherwise compileId
})
const importedFileRelativeUrl = `${testDirectoryRelativeUrl}foo.js`
const importedFileUrl = resolveUrl(
  `${outDirectoryRelativeUrl}${compileId}/${importedFileRelativeUrl}`,
  jsenvCoreDirectoryUrl,
)

await launchBrowsers([launchChromium, launchFirefox, launchWebkit], async (launchBrowser) => {
  const result = await launchAndExecute({
    ...EXECUTION_TEST_PARAMS,
    launchAndExecuteLogLevel: "off",
    launch: (options) =>
      launchBrowser({
        ...LAUNCH_TEST_PARAMS,
        ...options,
        outDirectoryRelativeUrl,
        compileServerOrigin,
      }),
    executeParams: {
      fileRelativeUrl: htmlFileRelativeUrl,
    },
  })
  const actual = {
    status: result.status,
    errorMessage: result.error.message,
  }
  const expected = {
    status: "errored",
    errorMessage: `Module file cannot be found.
--- import declared in ---
${importerFileRelativeUrl}
--- file ---
${importedFileRelativeUrl}
--- file url ---
${importedFileUrl}`,
  }
  assert({ actual, expected })
})
