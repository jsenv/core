import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import {
  execute,
  chromiumRuntime,
  firefoxRuntime,
  webkitRuntime,
} from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { COMPILE_ID_BEST } from "@jsenv/core/src/internal/CONSTANTS.js"
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
const htmlFilename = `import_meta_url.html`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}${htmlFilename}`
const fileRelativeUrl = `${testDirectoryRelativeUrl}import_meta_url.js`
const compileId = COMPILE_ID_BEST

await launchBrowsers(
  [
    // comment force multiline
    chromiumRuntime,
    firefoxRuntime,
    webkitRuntime,
  ],
  async (browserRuntime) => {
    const { status, namespace, compileServerOrigin, outDirectoryRelativeUrl } =
      await execute({
        ...EXECUTE_TEST_PARAMS,
        jsenvDirectoryRelativeUrl,
        runtime: browserRuntime,
        runtimeParams: {
          ...LAUNCH_TEST_PARAMS,
        },
        fileRelativeUrl: htmlFileRelativeUrl,
        collectCompileServerInfo: true,
      })
    const actual = {
      status,
      namespace,
    }
    const expected = {
      status: "completed",
      namespace: {
        [`./import_meta_url.js`]: {
          status: "completed",
          namespace: {
            isInstanceOfUrl: false,
            urlString:
              browserRuntime === chromiumRuntime
                ? `${compileServerOrigin}/${fileRelativeUrl}`
                : `${compileServerOrigin}/${outDirectoryRelativeUrl}${compileId}/${fileRelativeUrl}`,
          },
        },
      },
    }
    assert({ actual, expected })
  },
)
