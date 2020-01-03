import { assert } from "@jsenv/assert"
import { generateCommonJsBundle } from "../../../index.js"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  urlToFileSystemPath,
} from "@jsenv/util"
import { readFileContent } from "internal/filesystemUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { requireCommonJsBundle } from "../requireCommonJsBundle.js"
import {
  GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const bundleDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs/`
const firstEntryRelativeUrl = `${testDirectoryRelativeUrl}a.js`
const secondEntryRelativeUrl = `${testDirectoryRelativeUrl}b.js`

await generateCommonJsBundle({
  ...GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  bundleDirectoryRelativeUrl,
  entryPointMap: {
    a: `./${firstEntryRelativeUrl}`,
    b: `./${secondEntryRelativeUrl}`,
  },
  manifestFile: true,
})

{
  const manifestFileRelativeUrl = `${bundleDirectoryRelativeUrl}manifest.json`
  const manifestFileUrl = resolveUrl(manifestFileRelativeUrl, jsenvCoreDirectoryUrl)
  const manifestFilePath = urlToFileSystemPath(manifestFileUrl)
  const manifestFileContent = await readFileContent(manifestFilePath)
  const actual = JSON.parse(manifestFileContent)
  const expected = {
    "a.js": "a.js",
    "b.js": "b.js",
    "used-by-both.js": actual["used-by-both.js"],
  }
  assert({ actual, expected })
}
{
  const { namespace: actual } = await requireCommonJsBundle({
    ...REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
    bundleDirectoryRelativeUrl,
    mainRelativeUrl: "./a.js",
  })
  const expected = "a-shared"
  assert({ actual, expected })
}
{
  const { namespace: actual } = await requireCommonJsBundle({
    ...REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
    bundleDirectoryRelativeUrl,
    mainRelativeUrl: "./b.js",
  })
  const expected = "b-shared"
  assert({ actual, expected })
}
