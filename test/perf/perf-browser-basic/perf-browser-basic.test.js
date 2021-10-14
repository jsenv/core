import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import {
  execute,
  chromiumRuntime,
  firefoxRuntime,
  webkitRuntime,
} from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_EXECUTE.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}perf-browser-basic.html`

if (process.platform !== "win32") {
  await Promise.all(
    [
      // comment to ensure multiline
      chromiumRuntime,
      firefoxRuntime,
      webkitRuntime,
    ].map(async (browserRuntime) => {
      const actual = await execute({
        ...EXECUTE_TEST_PARAMS,
        jsenvDirectoryRelativeUrl,
        runtime: browserRuntime,
        fileRelativeUrl,
        stopAfterExecute: true,
        mirrorConsole: false,
        measurePerformance: true,
        collectPerformance: true,
        // runtimeParams: {
        //   headless: false,
        // },
        // stopAfterExecute: false,
      })
      const expected = {
        status: "completed",
        namespace: {
          [`./perf-browser-basic.js`]: {
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
}
