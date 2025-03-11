import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import {
  execute,
  chromiumRuntime,
  firefoxRuntime,
  // webkitRuntime,
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
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}main.html`
const imgRelativeUrl = `${testDirectoryRelativeUrl}src/jsenv.png`

await launchBrowsers(
  [
    // comment force multiline
    chromiumRuntime,
    firefoxRuntime,
    // webkitRuntime, // flaky on webkit don't know why (sometimes throw with "no registration found for JS")
  ],
  async (browserRuntime) => {
    const { status, namespace, compileServerOrigin } = await execute({
      ...EXECUTE_TEST_PARAMS,
      jsenvDirectoryRelativeUrl,
      launchAndExecuteLogLevel: "warn",
      runtime: browserRuntime,
      runtimeParams: {
        ...LAUNCH_TEST_PARAMS,
        // headless: false,
      },
      // stopAfterExecute: false,
      fileRelativeUrl: htmlFileRelativeUrl,
      collectCompileServerInfo: true,
    })
    const backgroundUrl =
      browserRuntime === chromiumRuntime
        ? `${compileServerOrigin}/${imgRelativeUrl}`
        : `${compileServerOrigin}/${jsenvDirectoryRelativeUrl}out_system/${imgRelativeUrl}`

    const actual = {
      status,
      namespace,
    }
    const expected = {
      status: "completed",
      namespace: {
        [browserRuntime === chromiumRuntime
          ? `./main.html__inline__10.js`
          : `./main.html__asset__10.js`]: {
          status: "completed",
          namespace: {
            bodyBackgroundColor: "rgb(255, 0, 0)",
            bodyBackgroundImage: `url("${backgroundUrl}")`,
          },
        },
      },
    }
    assert({ actual, expected })
  },
)
