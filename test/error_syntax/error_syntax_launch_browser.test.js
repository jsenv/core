import { assert } from "@jsenv/assert"
import {
  resolveUrl,
  urlToRelativeUrl,
  urlToFileSystemPath,
} from "@jsenv/filesystem"

import {
  execute,
  chromiumRuntime,
  firefoxRuntime,
  webkitRuntime,
} from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { COMPILE_ID_BEST } from "@jsenv/core/src/internal/CONSTANTS.js"
import {
  EXECUTE_TEST_PARAMS,
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

await launchBrowsers(
  [
    // comment force multiline
    chromiumRuntime,
    firefoxRuntime,
    webkitRuntime,
  ],
  async (browserRuntime) => {
    const { status, error, outDirectoryRelativeUrl } = await execute({
      ...EXECUTE_TEST_PARAMS,
      jsenvDirectoryRelativeUrl,
      launchAndExecuteLogLevel: "off",
      runtime: browserRuntime,
      runtimeParams: {
        ...LAUNCH_TEST_PARAMS,
        // headless: false,
      },
      // stopAfterExecute: false,
      fileRelativeUrl: htmlFileRelativeUrl,
      collectCompileServerInfo: true,
      ignoreError: true,
    })
    const compiledFileUrl = `${jsenvCoreDirectoryUrl}${outDirectoryRelativeUrl}${compileId}/${importedFileRelativeUrl}`

    if (browserRuntime === chromiumRuntime) {
      const actual = {
        status,
        error,
      }
      const expected = {
        status: "errored",
        error: new SyntaxError("Unexpected end of input"),
      }
      assert({ actual, expected })
      return
    }

    const actual = {
      status,
      errorMessage: error.message,
      errorParsingErrror: error.parsingError,
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
