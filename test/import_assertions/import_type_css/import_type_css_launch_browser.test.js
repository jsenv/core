import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

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
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFilename = `main.html`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}${htmlFilename}`
const { origin: compileServerOrigin, outDirectoryRelativeUrl } =
  await startCompileServer({
    ...START_COMPILE_SERVER_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
  })
const imgRelativeUrl = `${testDirectoryRelativeUrl}src/jsenv.png`
const imgCompiledRelativeUrl = `${outDirectoryRelativeUrl}best/${imgRelativeUrl}`
const imgCompiledUrl = resolveUrl(imgCompiledRelativeUrl, compileServerOrigin)

await launchBrowsers(
  [
    // comment force multiline
    launchChromium,
    launchFirefox,
    launchWebkit,
  ],
  async (launchBrowser) => {
    const result = await launchAndExecute({
      ...EXECUTION_TEST_PARAMS,
      launchAndExecuteLogLevel: "off",
      launch: (options) =>
        launchBrowser({
          ...LAUNCH_TEST_PARAMS,
          ...options,
          outDirectoryRelativeUrl,
          compileServerOrigin,
        }),
      executeParams: {
        fileRelativeUrl: htmlFileRelativeUrl,
      },
      // launchParams: {
      //   headless: false,
      // },
      // stopAfterExecute: false,
    })

    const actual = {
      status: result.status,
      namespace: result.namespace,
    }
    const expected = {
      status: "completed",
      namespace: {
        "./main.html__asset__10.js": {
          status: "completed",
          namespace: {
            bodyBackgroundColor: "rgb(255, 0, 0)",
            bodyBackgroundImage: `url("${imgCompiledUrl}")`,
          },
        },
      },
    }
    assert({ actual, expected })
  },
)
