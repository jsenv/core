import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { chromiumRuntime, firefoxRuntime, webkitRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { startCompileServer } from "@jsenv/core/src/internal/compile_server/compile_server.js"
import { launchAndExecute } from "@jsenv/core/src/internal/executing/launch_and_execute.js"
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
const fileRelativeUrl = `${testDirectoryRelativeUrl}top_level_await.html`
const { origin: compileServerOrigin, id } = await startCompileServer({
  ...START_COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})

await launchBrowsers(
  [
    // comment to force-multiline
    chromiumRuntime,
    firefoxRuntime,
    webkitRuntime,
  ],
  async (browserRuntime) => {
    const { status, namespace } = await launchAndExecute({
      ...EXECUTION_TEST_PARAMS,
      runtime: browserRuntime,
      runtimeParams: {
        ...LAUNCH_TEST_PARAMS,
        jsenvDirectoryRelativeUrl,
        compileServerOrigin,
        compileServerId: id,
      },
      executeParams: {
        fileRelativeUrl,
      },
    })
    const actual = {
      status,
      namespace,
    }
    const expected = {
      status: "completed",
      namespace: {
        "./top_level_await.js": {
          status: "completed",
          namespace: {
            value: 42,
          },
        },
      },
    }
    assert({ actual, expected })
  },
)
