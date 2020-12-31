import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_GLOBAL_BUILD_TEST_PARAMS,
  SCRIPT_LOAD_GLOBAL_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_GLOBAL.js"
import { scriptLoadGlobalBuild } from "@jsenv/core/test/scriptLoadGlobalBuild.js"
import { buildProject, convertCommonJsWithRollup } from "@jsenv/core"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs/`
const mainFilename = `${testDirectoryname}.js`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.js",
}
const convertMap = {
  "./node_modules/react/index.js": (options) =>
    convertCommonJsWithRollup({ ...options, processEnvNodeEnv: "dev" }),
}

await buildProject({
  ...GENERATE_GLOBAL_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
  convertMap,
})
const { globalValue: actual } = await scriptLoadGlobalBuild({
  ...SCRIPT_LOAD_GLOBAL_BUILD_TEST_PARAMS,
  buildDirectoryRelativeUrl,
})
const expected = "object"
assert({ actual, expected })
