import { basename } from "path"
import { assert } from "@jsenv/assert"
import { generateCommonJsBundle } from "../../../index.js"
import { resolveDirectoryUrl, urlToRelativeUrl } from "src/internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "src/internal/jsenvCoreDirectoryUrl.js"
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

await generateCommonJsBundle({
  ...GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  // compileServerLogLevel: "debug",
  jsenvDirectoryRelativeUrl,
  bundleDirectoryRelativeUrl,
  entryPointMap: {
    main: `./${testDirectoryRelativeUrl}${mainFileBasename}`,
  },
  // filesystemCache: true,
})

const { namespace: actual } = await requireCommonJsBundle({
  ...REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
  bundleDirectoryRelativeUrl,
})
const expected = 42
assert({ actual, expected })
