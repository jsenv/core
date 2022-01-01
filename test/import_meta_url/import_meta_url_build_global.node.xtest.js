import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_GLOBAL_BUILD_TEST_PARAMS,
  REQUIRE_GLOBAL_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_GLOBAL.js"
import { requireGlobalBuild } from "@jsenv/core/test/requireGlobalBuild.js"
import { buildProject } from "@jsenv/core"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const testDirectoryBasename = basename(testDirectoryRelativeUrl)
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/global/`
const mainFilename = `${testDirectoryBasename}.js`

await buildProject({
  ...GENERATE_GLOBAL_BUILD_TEST_PARAMS,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "main.js",
  },
})
const { globalValue: actual } = await requireGlobalBuild({
  ...REQUIRE_GLOBAL_BUILD_TEST_PARAMS,
  buildDirectoryRelativeUrl,
})
// global build do not set a global[globalName]
// value but rather a var so we cannot read that var
// we should ask rollup to make the iffe build different
// or support a new format called 'global'
// because iife it just a way to obtain a global variable without polluting
// global in the context of a browser
const expected = undefined

assert({ actual, expected })
