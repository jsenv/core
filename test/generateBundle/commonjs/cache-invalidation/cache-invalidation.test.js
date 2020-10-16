// here I want to test that, when cache, I can change source file
// and cache i invalidated

import { basename } from "path"
import { assert } from "@jsenv/assert"
import { generateCommonJsBundle } from "@jsenv/core/index.js"
import { resolveUrl, resolveDirectoryUrl, urlToRelativeUrl, writeFile } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { requireCommonJsBundle } from "../requireCommonJsBundle.js"
import {
  GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = basename(testDirectoryRelativeUrl)
const bundleDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs`
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const mainFileBasename = `${testDirectoryBasename}.js`
const mainFileRelativeUrl = `${testDirectoryRelativeUrl}${mainFileBasename}`
const mainFileUrl = resolveUrl(mainFileRelativeUrl, jsenvCoreDirectoryUrl)

const generateBundle = () =>
  generateCommonJsBundle({
    ...GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
    // logLevel: "debug",
    // compileServerLogLevel: "debug",
    jsenvDirectoryRelativeUrl,
    bundleDirectoryRelativeUrl,
    entryPointMap: {
      main: `./${testDirectoryRelativeUrl}${mainFileBasename}`,
    },
    filesystemCache: true,
  })

await writeFile(
  mainFileUrl,
  `export default 42
`,
)
await generateBundle()
await writeFile(
  mainFileUrl,
  `export default 43
`,
)
await generateBundle()

const { namespace: actual } = await requireCommonJsBundle({
  ...REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
  bundleDirectoryRelativeUrl,
})
const expected = 43
assert({ actual, expected })
