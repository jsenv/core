import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

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
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const htmlFilename = `export_not_found.html`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}${htmlFilename}`

const { origin: compileServerOrigin, outDirectoryRelativeUrl } =
  await startCompileServer({
    ...START_COMPILE_SERVER_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
  })

await launchBrowsers(
  [
    // comment force multiline
    launchChromium,
    launchFirefox,
    launchWebkit,
  ],
  async (launchBrowser) => {
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
      captureConsole: true,
      // launchParams: {
      //   headless: false,
      // },
      // stopAfterExecute: false,
    })

    if (launchBrowser === launchChromium) {
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
