import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "../../../src/internal/compiling/startCompileServer.js"
import { launchAndExecute } from "../../../src/internal/executing/launchAndExecute.js"
import { launchChromium, launchFirefox, launchWebkit } from "../../../index.js"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  EXECUTION_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const filename = `${testDirectoryBasename}.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...START_COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})

await Promise.all(
  [
    launchChromium,
    launchFirefox,
    /*
the following error occurs sometimes on windows + webkit

test/launchBrowser/top-level-await/top-level-await.html webkit/13.0.4: error during-execution.
--- error stack ---
global code@https://localhost:22826/test/launchBrowser/top-level-await/.jsenv/ou
t/otherwise/test/launchBrowser/top-level-await/top-level-await.html:11:23

For some reason it ends up in a timeout (instead of an error)
I assume because webkit browser fails to close so process never exits
*/
    ...(process.platform === "win32" ? [] : [launchWebkit]),
  ].map(async (launchBrowser) => {
    const actual = await launchAndExecute({
      ...EXECUTION_TEST_PARAMS,
      fileRelativeUrl,
      launch: (options) =>
        launchBrowser({
          ...LAUNCH_TEST_PARAMS,
          ...options,
          outDirectoryRelativeUrl,
          compileServerOrigin,
        }),
    })
    const expected = {
      status: "completed",
      namespace: {
        "./top-level-await.js": {
          status: "completed",
          namespace: {
            default: 42,
          },
        },
      },
    }
    assert({ actual, expected })
  }),
)
