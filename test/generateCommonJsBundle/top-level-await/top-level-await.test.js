import { basename } from "path"
import { assert } from "@jsenv/assert"
import { generateCommonJsBundle } from "../../../index.js"
import { resolveDirectoryUrl, urlToRelativeUrl } from "src/internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_COMMONJS_BUNDLE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const bundleDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs/`
const mainFilename = `${testDirectoryname}.js`

try {
  await generateCommonJsBundle({
    ...GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    bundleDirectoryRelativeUrl,
    entryPointMap: {
      main: `./${testDirectoryRelativeUrl}${mainFilename}`,
    },
  })
} catch (actual) {
  const expected = new Error(
    `Module format cjs does not support top-level await. Use the "es" or "system" output formats rather.`,
  )
  expected.code = "INVALID_TLA_FORMAT"
  assert({ actual, expected })
}
