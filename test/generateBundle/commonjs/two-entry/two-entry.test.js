import { assert } from "@jsenv/assert"
import { generateBundle } from "@jsenv/core/index.js"
import { resolveUrl, urlToRelativeUrl, readFile } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { requireCommonJsBundle } from "../requireCommonJsBundle.js"
import {
  GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const bundleDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs/`
const firstEntryRelativeUrl = `${testDirectoryRelativeUrl}a.js`
const secondEntryRelativeUrl = `${testDirectoryRelativeUrl}b.js`

await generateBundle({
  ...GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  bundleDirectoryRelativeUrl,
  entryPointMap: {
    [`./${firstEntryRelativeUrl}`]: "./a.cjs",
    [`./${secondEntryRelativeUrl}`]: "./b.cjs",
  },
  manifestFile: true,
})
{
  const manifestFileRelativeUrl = `${bundleDirectoryRelativeUrl}manifest.json`
  const manifestFileUrl = resolveUrl(manifestFileRelativeUrl, jsenvCoreDirectoryUrl)
  const manifestFileContent = await readFile(manifestFileUrl)
  const actual = JSON.parse(manifestFileContent)
  const expected = {
    "a.js": "a.cjs",
    "b.js": "b.cjs",
    "used-by-both.js": actual["used-by-both.js"],
  }
  assert({ actual, expected })
}
{
  const { namespace: actual } = await requireCommonJsBundle({
    ...REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
    bundleDirectoryRelativeUrl,
    mainRelativeUrl: "./a.cjs",
  })
  const expected = { value: "a-shared" }
  assert({ actual, expected })
}
{
  const { namespace: actual } = await requireCommonJsBundle({
    ...REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
    bundleDirectoryRelativeUrl,
    mainRelativeUrl: "./b.cjs",
  })
  const expected = { value: "b-shared" }
  assert({ actual, expected })
}
