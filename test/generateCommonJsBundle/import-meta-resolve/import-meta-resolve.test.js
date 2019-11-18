import { basename } from "path"
import { assert } from "@jsenv/assert"
import { generateCommonJsBundle } from "../../../index.js"
import { resolveDirectoryUrl, resolveFileUrl, urlToRelativePath } from "src/internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "src/internal/jsenvCoreDirectoryUrl.js"
import { requireCommonJsBundle } from "../requireCommonJsBundle.js"
import {
  GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativePath(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const bundleDirectoryRelativeUrl = `${testDirectoryRelativePath}dist/commonjs`
const mainFileBasename = `${testDirectoryBasename}.js`

await generateCommonJsBundle({
  ...GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  bundleDirectoryRelativeUrl,
  importMapFileRelativeUrl: `${testDirectoryRelativePath}importMap.json`,
  entryPointMap: {
    main: `./${testDirectoryRelativePath}${mainFileBasename}`,
  },
})

const { namespace: actual } = await requireCommonJsBundle({
  ...REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
  bundleDirectoryRelativeUrl,
})
const expected = {
  basic: resolveFileUrl(`${bundleDirectoryRelativeUrl}/file.js`, jsenvCoreDirectoryUrl),
  remapped: `file:///bar`,
}
assert({ actual, expected })
