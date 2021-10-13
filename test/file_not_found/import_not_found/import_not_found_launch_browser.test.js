import { assert } from "@jsenv/assert"
import {
  resolveUrl,
  resolveDirectoryUrl,
  urlToRelativeUrl,
} from "@jsenv/filesystem"

import { chromiumRuntime, firefoxRuntime, webkitRuntime } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { COMPILE_ID_BEST } from "@jsenv/core/src/internal/CONSTANTS.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { launchAndExecute } from "@jsenv/core/src/internal/executing/launchAndExecute.js"
import { launchBrowsers } from "@jsenv/core/test/launchBrowsers.js"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  EXECUTION_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_BROWSER.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const htmlFilename = `import_not_found.html`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}${htmlFilename}`
const mainFileRelativeUrl = `${testDirectoryRelativeUrl}import_not_found.js`
const importerFileRelativeUrl = `${testDirectoryRelativeUrl}intermediate.js`
const compileId = COMPILE_ID_BEST
const { origin: compileServerOrigin, outDirectoryRelativeUrl } =
  await startCompileServer({
    ...START_COMPILE_SERVER_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
  })
const importedFileRelativeUrl = `${testDirectoryRelativeUrl}foo.js`

await launchBrowsers(
  [
    // comment force multiline
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
        }
      executeParams: {
        fileRelativeUrl: htmlFileRelativeUrl,
      },
      // runtimeParams: {
      //   headless: false,
      // },
      // stopAfterExecute: false,
    })

    if (launchBrowser === chromiumRuntime) {
      const mainFileUrl = resolveUrl(mainFileRelativeUrl, jsenvCoreDirectoryUrl)
      const actual = {
        status: result.status,
        errorMessage: result.error.message,
      }
      const expected = {
        status: "errored",
        errorMessage: `Failed to fetch dynamically imported module: ${mainFileUrl}`,
      }
      assert({ actual, expected })
      return
    }

    const importedFileUrl = resolveUrl(
      `${outDirectoryRelativeUrl}${compileId}/${importedFileRelativeUrl}`,
      jsenvCoreDirectoryUrl,
    )
    const actual = {
      status: result.status,
      errorMessage: result.error.message,
    }
    const expected = {
      status: "errored",
      errorMessage: `JavaScript module file cannot be found
--- import declared in ---
${importerFileRelativeUrl}
--- file ---
${importedFileRelativeUrl}
--- file url ---
${importedFileUrl}`,
    }
    assert({ actual, expected })
  },
)
