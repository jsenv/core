import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, urlToFileSystemPath } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { launchAndExecute } from "@jsenv/core/src/internal/executing/launchAndExecute.js"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  EXECUTION_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_BROWSER.js"
import { launchBrowsers } from "@jsenv/core/test/launchBrowsers.js"
import { launchChromium, launchFirefox, launchWebkit } from "@jsenv/core"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFilename = `${testDirectoryname}.html`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}${htmlFilename}`
const compileId = "otherwise"
const importedFileRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryname}.js`
const importedFileUrl = resolveUrl(importedFileRelativeUrl, jsenvCoreDirectoryUrl)
const importedFilePath = urlToFileSystemPath(importedFileUrl)
const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...START_COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  compileGroupCount: 1,
})
const compiledFileUrl = `${jsenvCoreDirectoryUrl}${outDirectoryRelativeUrl}${compileId}/${importedFileRelativeUrl}`

await launchBrowsers([launchChromium, launchFirefox, launchWebkit], async (launchBrowser) => {
  const result = await launchAndExecute({
    ...EXECUTION_TEST_PARAMS,
    executionLogLevel: "off",
    launch: (options) =>
      launchBrowser({
        ...LAUNCH_TEST_PARAMS,
        ...options,
        outDirectoryRelativeUrl,
        compileServerOrigin,
      }),
    fileRelativeUrl: htmlFileRelativeUrl,
  })
  const actual = {
    status: result.status,
    errorMessage: result.error.message,
    errorParsingErrror: result.error.parsingError,
  }
  const expected = {
    status: "errored",
    errorMessage: `Module file cannot be parsed.
--- parsing error message ---
${importedFilePath}: Unexpected token (1:17)

> 1 | const browser = (
    |                  ^
--- file ---
${importedFileRelativeUrl}
--- file url ---
${compiledFileUrl}`,
    errorParsingErrror: {
      message: `${importedFilePath}: Unexpected token (1:17)

> 1 | const browser = (
    |                  ^`,
      messageHTML: assert.any(String),
      filename: importedFilePath,
      lineNumber: 1,
      columnNumber: 17,
    },
  }
  assert({ actual, expected })
})
