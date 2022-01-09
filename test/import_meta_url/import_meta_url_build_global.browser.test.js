import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_GLOBAL_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_GLOBAL.js"
import { executeFileUsingBrowserScript } from "@jsenv/core/test/execution_with_browser_script.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/global/`
await buildProject({
  ...GENERATE_GLOBAL_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl: `${testDirectoryRelativeUrl}.jsenv/`,
  buildDirectoryRelativeUrl,
  entryPoints: {
    [`./${testDirectoryRelativeUrl}import_meta_url.js`]: "main.js",
  },
})
const { globalValue, serverOrigin } = await executeFileUsingBrowserScript({
  buildDirectoryUrl: resolveUrl(
    buildDirectoryRelativeUrl,
    jsenvCoreDirectoryUrl,
  ),
  jsFileRelativeUrl: "./main.js",
})

const actual = globalValue
const expected = {
  isInstanceOfUrl: false,
  urlString: `${serverOrigin}/main.js`,
}
assert({ actual, expected })
