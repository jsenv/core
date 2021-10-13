import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { chromiumRuntime, firefoxRuntime, webkitRuntime } from "@jsenv/core"
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
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const filename = `error_runtime.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const { origin: compileServerOrigin, outDirectoryRelativeUrl } =
  await startCompileServer({
    ...START_COMPILE_SERVER_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
  })

await launchBrowsers(
  [
    // comment to ensure multiline
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
        // headless: false,
      },
      executeParams: {
        fileRelativeUrl,
      },
      captureConsole: true,
    })

    const actual = {
      status: result.status,
      errorMessage: result.error.message,
    }
    const expected = {
      status: "errored",
      errorMessage: "SPECIAL_STRING_UNLIKELY_TO_COLLIDE",
    }
    assert({ actual, expected })

    // error stack
    {
      const stack = result.error.stack
      if (browserRuntime === chromiumRuntime) {
        const expected = `Error: SPECIAL_STRING_UNLIKELY_TO_COLLIDE
    at triggerError (${testDirectoryUrl}trigger_error.js:2:9)
    at ${testDirectoryUrl}error_runtime.js:3:1`
        const actual = stack.slice(0, expected.length)
        assert({ actual, expected })
      } else if (browserRuntime === firefoxRuntime) {
        const expected = `Error: SPECIAL_STRING_UNLIKELY_TO_COLLIDE`
        const actual = stack.slice(0, expected.length)
        assert({ actual, expected })
      } else {
        const actual = typeof stack
        const expected = `string`
        assert({ actual, expected })
      }
    }
  },
)
