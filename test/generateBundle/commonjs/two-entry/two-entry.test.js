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

const { bundleManifest, bundleMappings } = await generateBundle({
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
  const actual = bundleMappings
  const expected = {
    [`${testDirectoryRelativeUrl}a.js`]: "a.cjs",
    [`${testDirectoryRelativeUrl}b.js`]: "b.cjs",
    [`${testDirectoryRelativeUrl}used-by-both.js`]: actual[
      `${testDirectoryRelativeUrl}used-by-both.js`
    ],
  }
  assert({ actual, expected })
}

{
  const manifestFileRelativeUrl = `${bundleDirectoryRelativeUrl}manifest.json`
  const manifestFileUrl = resolveUrl(manifestFileRelativeUrl, jsenvCoreDirectoryUrl)
  const manifestFileContent = await readFile(manifestFileUrl)
  const manifestFileObject = JSON.parse(manifestFileContent)
  const actual = manifestFileObject
  const expected = {
    [`a.cjs`]: "a.cjs",
    [`b.cjs`]: "b.cjs",
    [`used-by-both.cjs`]: actual[`used-by-both.cjs`],
  }
  assert({ actual, expected })

  {
    const actual = manifestFileObject
    const expected = bundleManifest
    assert({ actual, expected })
  }
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
