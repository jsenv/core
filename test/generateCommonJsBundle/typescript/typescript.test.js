import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { require } from "../../../src/internal/require.js"
import { generateCommonJsBundle } from "../../../index.js"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { requireCommonJsBundle } from "../requireCommonJsBundle.js"
import {
  GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const transformTypeScript = require("@babel/plugin-transform-typescript")

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const bundleDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs`
const mainFileBasename = `${testDirectoryname}.ts`

await generateCommonJsBundle({
  ...GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  babelPluginMap: {
    ...GENERATE_COMMONJS_BUNDLE_TEST_PARAMS.babelPluginMap,
    "transform-typescript": [transformTypeScript],
  },
  jsenvDirectoryRelativeUrl,
  bundleDirectoryRelativeUrl,
  entryPointMap: {
    main: `./${testDirectoryRelativeUrl}${mainFileBasename}`,
  },
})
const { namespace: actual } = await requireCommonJsBundle({
  ...REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
  bundleDirectoryRelativeUrl,
})
const expected = "Hello, Jane User"
assert({ actual, expected })
