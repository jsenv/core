import { assert } from "@jsenv/assert"
import { generateCommonJsBundle } from "../../../index.js"
import { resolveDirectoryUrl, urlToRelativePath } from "src/internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "src/internal/jsenvCoreDirectoryUrl.js"
import { requireCommonJsBundle } from "../requireCommonJsBundle.js"
import {
  GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativePath(testDirectoryUrl, jsenvCoreDirectoryUrl)
const bundleDirectoryRelativeUrl = `${testDirectoryRelativePath}dist/commonjs`
const firstEntryFileRelativePath = `${testDirectoryRelativePath}a.js`
const secondEntryFileRelativePath = `${testDirectoryRelativePath}b.js`

await generateCommonJsBundle({
  ...GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  bundleDirectoryRelativeUrl,
  entryPointMap: {
    a: firstEntryFileRelativePath,
    b: secondEntryFileRelativePath,
  },
})

{
  const { namespace: actual } = await requireCommonJsBundle({
    ...REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
    bundleDirectoryRelativeUrl,
    mainRelativePath: "./a.js",
  })
  const expected = "a-shared"
  assert({ actual, expected })
}
{
  const { namespace: actual } = await requireCommonJsBundle({
    ...REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
    bundleDirectoryRelativeUrl,
    mainRelativePath: "./b.js",
  })
  const expected = "b-shared"
  assert({ actual, expected })
}
