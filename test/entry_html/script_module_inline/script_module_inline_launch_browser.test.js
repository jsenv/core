import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { launchChromium, launchFirefox, launchWebkit } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { launchAndExecute } from "@jsenv/core/src/internal/executing/launchAndExecute.js"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  EXECUTION_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_BROWSER.js"
import { launchBrowsers } from "@jsenv/core/test/launchBrowsers.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const filename = `script_module_inline.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const { origin: compileServerOrigin, outDirectoryRelativeUrl } =
  await startCompileServer({
    ...START_COMPILE_SERVER_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
  })

await launchBrowsers(
  [
    // comment to ensure multiline
    launchChromium,
    launchFirefox,
    launchWebkit,
  ],
  async (launchBrowser) => {
    const actual = await launchAndExecute({
      ...EXECUTION_TEST_PARAMS,
      launch: (options) =>
        launchBrowser({
          ...LAUNCH_TEST_PARAMS,
          ...options,
          outDirectoryRelativeUrl,
          compileServerOrigin,
          // headless: false,
        }),
      executeParams: {
        fileRelativeUrl,
      },
      captureConsole: true,
      // stopAfterExecute: false,
    })
    const expected = {
      status: "completed",
      namespace: {
        [launchBrowser === launchChromium
          ? `./script_module_inline_script_module_inline.js`
          : `./script_module_inline.html__asset__script_module_inline.js`]: {
          status: "completed",
          namespace: {
            value: 42,
          },
        },
      },
      consoleCalls: [],
    }
    assert({ actual, expected })
  },
)
