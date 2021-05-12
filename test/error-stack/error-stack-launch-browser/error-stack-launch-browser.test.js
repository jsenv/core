import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, urlToBasename } from "@jsenv/util"

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

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const filename = `${testDirectoryBasename}.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...START_COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})

await launchBrowsers([launchChromium, launchFirefox, launchWebkit], async (launchBrowser) => {
  const result = await launchAndExecute({
    ...EXECUTION_TEST_PARAMS,
    // sets executionLogLevel to off to avoid seeing an expected error in logs
    executionLogLevel: "off",
    // stopAfterExecute: false,
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
    mirrorConsole: true,
  })

  const stack = result.error.stack

  if (launchBrowser === launchChromium) {
    const expected = `Error: error
  at triggerError (${testDirectoryUrl}trigger-error.js:2:9)
  at Object.triggerError (${testDirectoryUrl}${testDirectoryBasename}.js:3:1)`
    const actual = stack.slice(0, expected.length)
    assert({ actual, expected })
  } else if (launchBrowser === launchFirefox) {
    const expected = `Error: error`
    const actual = stack.slice(0, expected.length)
    assert({ actual, expected })
  } else {
    const actual = typeof stack
    const expected = `string`
    assert({ actual, expected })
  }
})
