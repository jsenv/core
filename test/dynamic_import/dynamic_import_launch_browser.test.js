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
const filename = `dynamic_import.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const { origin: compileServerOrigin, outDirectoryRelativeUrl } =
  await startCompileServer({
    ...START_COMPILE_SERVER_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
  })

await launchBrowsers(
  [
    // comment to force-multiline
    launchChromium,
    launchFirefox,
    launchWebkit,
  ],
  async (launchBrowser) => {
    const actual = await launchAndExecute({
      ...EXECUTION_TEST_PARAMS,
      launch: launchBrowser,
      launchParams: {
        ...LAUNCH_TEST_PARAMS,
        compileServerOrigin,
        outDirectoryRelativeUrl,
      },
      executeParams: {
        fileRelativeUrl,
      },
    })
    const expected = {
      status: "completed",
      namespace: {
        "./dynamic_import.js": {
          status: "completed",
          namespace: {
            default: 42,
          },
        },
      },
    }
    assert({ actual, expected })
  },
)
