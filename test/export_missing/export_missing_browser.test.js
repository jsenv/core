import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import {
  execute,
  chromiumRuntime,
  firefoxRuntime,
  webkitRuntime,
} from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { launchBrowsers } from "@jsenv/core/test/launchBrowsers.js"
import {
  EXECUTE_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_BROWSER.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const htmlFilename = `export_missing.html`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}${htmlFilename}`

await launchBrowsers(
  [
    // comment force multiline
    chromiumRuntime,
    firefoxRuntime,
    webkitRuntime,
  ],
  async (browserRuntime) => {
    const result = await execute({
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
      captureConsole: true,
      ignoreError: true,
    })

    if (browserRuntime === chromiumRuntime) {
      const actual = {
        status: result.status,
        errorMessage: result.error.message,
      }
      const expected = {
        status: "errored",
        errorMessage: `The requested module './file.js' does not provide an export named 'answer'`,
      }
      assert({ actual, expected })
      return
    }

    const actual = {
      status: result.status,
      consoleCalls: result.consoleCalls,
    }
    const expected = {
      status: "completed",
      consoleCalls: [
        {
          type: "log",
          text:
            process.platform === "win32"
              ? actual.consoleCalls[0].text
              : `undefined\n`,
        },
      ],
    }
    assert({ actual, expected })
  },
)
