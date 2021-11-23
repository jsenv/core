import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import {
  execute,
  chromiumRuntime,
  firefoxRuntime,
  webkitRuntime,
} from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  EXECUTE_TEST_PARAMS,
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

await launchBrowsers(
  [
    // comment to ensure multiline
    chromiumRuntime,
    firefoxRuntime,
    webkitRuntime,
  ],
  async (browserRuntime) => {
    const { status, namespace, consoleCalls } = await execute({
      ...EXECUTE_TEST_PARAMS,
      jsenvDirectoryRelativeUrl,
      // logLevel: "debug",
      runtime: browserRuntime,
      runtimeParams: {
        ...LAUNCH_TEST_PARAMS,
        // headless: false,
      },
      fileRelativeUrl,
      captureConsole: true,
      // stopAfterExecute: false,
    })
    const actual = {
      status,
      namespace,
      consoleCalls,
    }
    const expected = {
      status: "completed",
      namespace: {
        [browserRuntime === chromiumRuntime
          ? `./script_module_inline.html__inline__script_module_inline.js`
          : `./script_module_inline.html__asset__script_module_inline.js`]: {
          status: "completed",
          namespace: {
            answer: 42,
          },
        },
      },
      consoleCalls: [],
    }
    assert({ actual, expected })
  },
)
