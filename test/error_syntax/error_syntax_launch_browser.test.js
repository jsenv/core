import {
  resolveUrl,
  urlToRelativeUrl,
  urlToFileSystemPath,
} from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import {
  execute,
  chromiumRuntime,
  firefoxRuntime,
  webkitRuntime,
} from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
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
const htmlRelativeUrl = `${testDirectoryRelativeUrl}error_syntax.html`
const jsRelativeUrl = `${testDirectoryRelativeUrl}error_syntax.js`
const jsUrl = resolveUrl(jsRelativeUrl, jsenvCoreDirectoryUrl)
const jsPath = urlToFileSystemPath(jsUrl)

await launchBrowsers(
  [
    // comment force multiline
    chromiumRuntime,
    firefoxRuntime,
    webkitRuntime,
  ],
  async (browserRuntime) => {
    const { status, error } = await execute({
      ...EXECUTE_TEST_PARAMS,
      jsenvDirectoryRelativeUrl,
      launchAndExecuteLogLevel: "off",
      runtime: browserRuntime,
      runtimeParams: {
        ...LAUNCH_TEST_PARAMS,
        // headless: false,
      },
      // stopAfterExecute: false,
      fileRelativeUrl: htmlRelativeUrl,
      collectCompileServerInfo: true,
      ignoreError: true,
    })
    const jsCompiledUrl = `${jsenvCoreDirectoryUrl}${jsenvDirectoryRelativeUrl}out/${jsRelativeUrl}`
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
${jsPath}: Unexpected token (1:11)

> 1 | const a = (
    |            ^
--- file ---
${jsRelativeUrl}
--- file url ---
${jsCompiledUrl}`,
      errorParsingErrror: {
        message: `${jsPath}: Unexpected token (1:11)

> 1 | const a = (
    |            ^`,
        messageHTML: assert.any(String),
        filename: jsPath,
        lineNumber: 1,
        columnNumber: 11,
      },
    }
    assert({ actual, expected })
  },
)
