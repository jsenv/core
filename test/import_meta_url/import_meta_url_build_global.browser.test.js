import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_GLOBAL_BUILD_TEST_PARAMS,
  SCRIPT_LOAD_GLOBAL_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_GLOBAL.js"
import { scriptLoadGlobalBuild } from "@jsenv/core/test/scriptLoadGlobalBuild.js"
import { buildProject } from "@jsenv/core"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/global/`
const mainFilename = `${testDirectoryname}.js`
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

const actual = globalValue
const expected = {
  isInstanceOfUrl: false,
  urlString: `${serverOrigin}/main.js`,
}
assert({ actual, expected })
