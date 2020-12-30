import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { requireCommonJsBuild } from "@jsenv/core/test/requireCommonJsBuild.js"
import {
  GENERATE_COMMONJS_BUILD_TEST_PARAMS,
  REQUIRE_COMMONJS_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_COMMONJS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs`
const mainFilename = `${testDirectoryname}.js`

await buildProject({
  ...GENERATE_COMMONJS_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.cjs",
  },
})
const {
  namespace: { ask },
} = await requireCommonJsBuild({
  ...REQUIRE_COMMONJS_BUILD_TEST_PARAMS,
  buildDirectoryRelativeUrl,
})
const actual = await ask()
const expected = 42
assert({ actual, expected })
