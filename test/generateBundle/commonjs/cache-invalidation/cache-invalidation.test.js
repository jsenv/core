// here I want to test that, when cache, I can change source file
// and cache i invalidated

import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, resolveDirectoryUrl, urlToRelativeUrl, writeFile } from "@jsenv/util"
import { generateBundle } from "@jsenv/core/index.js"
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
const mainFilename = `${testDirectoryBasename}.js`
const mainFileRelativeUrl = `${testDirectoryRelativeUrl}${mainFilename}`
const mainFileUrl = resolveUrl(mainFileRelativeUrl, jsenvCoreDirectoryUrl)

const generate = () =>
  generateBundle({
    ...GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
    // logLevel: "debug",
    // compileServerLogLevel: "debug",
    jsenvDirectoryRelativeUrl,
    bundleDirectoryRelativeUrl,
    entryPointMap: {
      [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.cjs",
    },
    filesystemCache: true,
  })

await writeFile(
  mainFileUrl,
  `export default 42
`,
)
await generate()
await writeFile(
  mainFileUrl,
  `export default 43
`,
)
await generate()

const { namespace: actual } = await requireCommonJsBundle({
  ...REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
  bundleDirectoryRelativeUrl,
})
const expected = 43
assert({ actual, expected })
