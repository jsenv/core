import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { buildProject } from "@jsenv/core/index.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { requireCommonJsBuild } from "../requireCommonJsBuild.js"
import {
  GENERATE_COMMONJS_BUILD_TEST_PARAMS,
  REQUIRE_COMMONJS_BUILD_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs`
const mainFileBasename = `${testDirectoryname}.js`

await buildProject({
  ...GENERATE_COMMONJS_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}${mainFileBasename}`]: "./main.cjs",
  },
})

const { namespace: actual } = await requireCommonJsBuild({
  ...REQUIRE_COMMONJS_BUILD_TEST_PARAMS,
  buildDirectoryRelativeUrl,
})
const expected = {
  url: resolveUrl(`${buildDirectoryRelativeUrl}/main.cjs`, jsenvCoreDirectoryUrl),
}
assert({ actual, expected })
