import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_GLOBAL_BUILD_TEST_PARAMS,
  SCRIPT_LOAD_GLOBAL_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_GLOBAL.js"
import { scriptLoadGlobalBuild } from "@jsenv/core/test/scriptLoadGlobalBuild.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/global/`
const mainFilename = `index.js`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.js",
}

await buildProject({
  ...GENERATE_GLOBAL_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
})
const { globalValue, serverOrigin } = await scriptLoadGlobalBuild({
  ...SCRIPT_LOAD_GLOBAL_BUILD_TEST_PARAMS,
  buildDirectoryRelativeUrl,
})
// it would be great to have an error or at least a warning.
const actual = globalValue.jsUrl
const expected = String(new URL(`./file.js`, serverOrigin))
assert({ actual, expected })
