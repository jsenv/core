import { basename } from "path"
import { assert } from "@jsenv/assert"
import { generateGlobalBundle } from "../../../index.js"
import { resolveDirectoryUrl, urlToRelativePath } from "src/internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "src/internal/jsenvCoreDirectoryUrl.js"
import { requireGlobalBundle } from "../requireGlobalBundle.js"
import {
  GENERATE_GLOBAL_BUNDLE_TEST_PARAMS,
  REQUIRE_GLOBAL_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativePath(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const bundleDirectoryRelativeUrl = `${testDirectoryRelativePath}dist/commonjs/`
const mainFileBasename = `${testDirectoryBasename}.js`

await generateGlobalBundle({
  ...GENERATE_GLOBAL_BUNDLE_TEST_PARAMS,
  bundleDirectoryRelativeUrl,
  entryPointMap: {
    main: `${testDirectoryRelativePath}${mainFileBasename}`,
  },
})
const { globalValue: actual } = await requireGlobalBundle({
  ...REQUIRE_GLOBAL_BUNDLE_TEST_PARAMS,
  bundleDirectoryRelativeUrl,
})
// global bundle do not set a global[globalName]
// value but rather a var so we cannot read that var
// we should ask rollup to make the iffe bundle different
// or support a new format called 'global'
// because iife it just a way to obtain a global variable without polluting
// global in the context of a browser
const expected = undefined

assert({ actual, expected })
