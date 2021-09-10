import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, urlToBasename } from "@jsenv/filesystem"

import {
  execute,
  launchChromium,
  launchFirefox,
  launchWebkit,
} from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_EXECUTE.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryname}.html`
const executeParams = {
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  fileRelativeUrl,
  stopAfterExecute: true,
  mirrorConsole: false,
}

await Promise.all(
  [
    // comment to ensure multiline
    launchChromium,
    launchFirefox,
    launchWebkit,
  ].map(async (launchBrowser) => {
    const actual = await execute({
      ...executeParams,
      launch: launchBrowser,
      measurePerformance: true,
      collectPerformance: true,
      // launchParams: {
      //   headless: false,
      // },
      // stopAfterExecute: false,
    })
    const expected = {
      status: "completed",
      namespace: {
        [`./${testDirectoryname}.js`]: {
          status: "completed",
          namespace: {},
        },
      },
      performance: {
        timeOrigin: assert.any(Number),
        timing: actual.performance.timing,
        navigation: {
          type: 0,
          redirectCount: 0,
        },
        measures: {
          "jsenv_file_import": assert.any(Number),
          "a to b": assert.any(Number),
        },
      },
    }
    assert({ actual, expected })
  }),
)
