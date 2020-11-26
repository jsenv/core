import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { generateBundle } from "@jsenv/core/index.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { requireCommonJsBundle } from "../requireCommonJsBundle.js"
import {
  GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs`
const mainFilename = `${testDirectoryname}.js`

await generateBundle({
  ...GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  importMapFileRelativeUrl: `${testDirectoryRelativeUrl}test.importmap`,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.cjs",
  },
})

const { namespace } = await requireCommonJsBundle({
  ...REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
  buildDirectoryRelativeUrl,
})
const actual = {
  relative: await namespace.relative,
  bareA: await namespace.bareA,
  bareB: await namespace.bareB,
}
const expected = {
  relative: resolveUrl(`${buildDirectoryRelativeUrl}/file.js`, jsenvCoreDirectoryUrl),
  bareA: resolveUrl(`${buildDirectoryRelativeUrl}/bar`, jsenvCoreDirectoryUrl),
  bareB: "file:///bar",
}
assert({ actual, expected })
