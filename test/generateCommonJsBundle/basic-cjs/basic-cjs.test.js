import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { generateCommonJsBundle } from "../../../index.js"
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
const mainFileBasename = `${testDirectoryBasename}.cjs`

await generateCommonJsBundle({
  ...GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  bundleDirectoryRelativeUrl,
  entryPointMap: {
    main: `./${testDirectoryRelativeUrl}${mainFileBasename}`,
  },
})

const { namespace: actual } = await requireCommonJsBundle({
  ...REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
  mainRelativeUrl: "./main.cjs",
  bundleDirectoryRelativeUrl,
})
const expected = 42
assert({ actual, expected })
