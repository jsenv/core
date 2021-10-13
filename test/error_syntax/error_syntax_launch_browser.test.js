import { assert } from "@jsenv/assert"
import {
  resolveUrl,
  urlToRelativeUrl,
  urlToFileSystemPath,
} from "@jsenv/filesystem"

import { chromiumRuntime, firefoxRuntime, webkitRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { COMPILE_ID_BEST } from "@jsenv/core/src/internal/CONSTANTS.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { launchAndExecute } from "@jsenv/core/src/internal/executing/launchAndExecute.js"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  EXECUTION_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_BROWSER.js"
import { launchBrowsers } from "@jsenv/core/test/launchBrowsers.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFilename = `error_syntax.html`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}${htmlFilename}`
const compileId = COMPILE_ID_BEST
const importedFileRelativeUrl = `${testDirectoryRelativeUrl}error_syntax.js`
const importedFileUrl = resolveUrl(
  importedFileRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const importedFilePath = urlToFileSystemPath(importedFileUrl)
const { origin: compileServerOrigin, outDirectoryRelativeUrl } =
  await startCompileServer({
    ...START_COMPILE_SERVER_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
  })
const compiledFileUrl = `${jsenvCoreDirectoryUrl}${outDirectoryRelativeUrl}${compileId}/${importedFileRelativeUrl}`

await launchBrowsers(
  [
    // comment force multiline
    chromiumRuntime,
    firefoxRuntime,
    webkitRuntime,
  ],
  async (browserRuntime) => {
    const result = await launchAndExecute({
      ...EXECUTION_TEST_PARAMS,
      launchAndExecuteLogLevel: "off",
      runtime: browserRuntime,
runtimeParams: {
          ...LAUNCH_TEST_PARAMS,
          outDirectoryRelativeUrl,
          compileServerOrigin,
        }
      executeParams: {
        fileRelativeUrl: htmlFileRelativeUrl,
      },
      // runtimeParams: {
      //   headless: false,
      // },
      // stopAfterExecute: false,
    })

    if (launchBrowser === chromiumRuntime) {
      const actual = {
        status: result.status,
        error: result.error,
      }
      const expected = {
        status: "errored",
        error: new SyntaxError("Unexpected end of input"),
      }
      assert({ actual, expected })
      return
    }

    const actual = {
      status: result.status,
      errorMessage: result.error.message,
      errorParsingErrror: result.error.parsingError,
    }
    const expected = {
      status: "errored",
      errorMessage: `JavaScript module file cannot be parsed
--- parsing error message ---
${importedFilePath}: Unexpected token (1:11)

> 1 | const a = (
    |            ^
--- file ---
${importedFileRelativeUrl}
--- file url ---
${compiledFileUrl}`,
      errorParsingErrror: {
        message: `${importedFilePath}: Unexpected token (1:11)

> 1 | const a = (
    |            ^`,
        messageHTML: assert.any(String),
        filename: importedFilePath,
        lineNumber: 1,
        columnNumber: 11,
      },
    }
    assert({ actual, expected })
  },
)
