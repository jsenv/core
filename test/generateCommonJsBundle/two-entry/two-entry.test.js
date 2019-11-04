import { assert } from "@dmail/assert"
import { generateCommonJsBundle } from "../../../index.js"
import { resolveDirectoryUrl, fileUrlToRelativePath } from "src/private/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "src/private/jsenvCoreDirectoryUrl.js"
import { requireCommonJsBundle } from "../requireCommonJsBundle.js"
import {
  GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = fileUrlToRelativePath(testDirectoryUrl, jsenvCoreDirectoryUrl)
const bundleDirectoryRelativePath = `${testDirectoryRelativePath}dist/commonjs`
const firstEntryFileRelativePath = `${testDirectoryRelativePath}a.js`
const secondEntryFileRelativePath = `${testDirectoryRelativePath}b.js`

await generateCommonJsBundle({
  ...GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  bundleDirectoryRelativePath,
  entryPointMap: {
    a: firstEntryFileRelativePath,
    b: secondEntryFileRelativePath,
  },
})

{
  const { namespace: actual } = await requireCommonJsBundle({
    ...REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
    bundleDirectoryRelativePath,
    mainRelativePath: "./a.js",
  })
  const expected = "a-shared"
  assert({ actual, expected })
}
{
  const { namespace: actual } = await requireCommonJsBundle({
    ...REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
    bundleDirectoryRelativePath,
    mainRelativePath: "./b.js",
  })
  const expected = "b-shared"
  assert({ actual, expected })
}
