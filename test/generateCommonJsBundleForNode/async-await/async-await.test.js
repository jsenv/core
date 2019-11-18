import { basename } from "path"
import { assert } from "@jsenv/assert"
import { generateCommonJsBundleForNode } from "../../../index.js"
import { resolveDirectoryUrl, urlToRelativePath } from "src/internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "src/internal/jsenvCoreDirectoryUrl.js"
import { requireCommonJsBundle } from "../requireCommonJsBundle.js"
import {
  GENERATE_COMMONJS_BUNDLE_FOR_NODE_TEST_PARAMS,
  REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativePath(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const bundleDirectoryRelativeUrl = `${testDirectoryRelativePath}dist/commonjs`
const mainFileBasename = `${testDirectoryBasename}.js`

await generateCommonJsBundleForNode({
  ...GENERATE_COMMONJS_BUNDLE_FOR_NODE_TEST_PARAMS,
  bundleDirectoryRelativeUrl,
  entryPointMap: {
    main: `${testDirectoryRelativePath}${mainFileBasename}`,
  },
})

const {
  namespace: { ask },
} = await requireCommonJsBundle({
  ...REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
  bundleDirectoryRelativeUrl,
})
const actual = await ask()
const expected = 42
assert({ actual, expected })
