import { basename } from "path"
import { assert } from "@jsenv/assert"
import { generateSystemJsBundle } from "../../../index.js"
import { resolveDirectoryUrl, urlToRelativePath } from "src/internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "src/internal/jsenvCoreDirectoryUrl.js"
import { browserImportSystemJsBundle } from "../browserImportSystemJsBundle.js"
import {
  GENERATE_SYSTEMJS_BUNDLE_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativePath(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const bundleDirectoryRelativeUrl = `${testDirectoryRelativePath}dist/commonjs/`
const mainFileBasename = `${testDirectoryBasename}.js`

await generateSystemJsBundle({
  ...GENERATE_SYSTEMJS_BUNDLE_TEST_PARAMS,
  bundleDirectoryRelativeUrl,
  entryPointMap: {
    main: `${testDirectoryRelativePath}${mainFileBasename}`,
  },
})
const { namespace: actual } = await browserImportSystemJsBundle({
  ...IMPORT_SYSTEM_JS_BUNDLE_TEST_PARAMS,
  testDirectoryRelativePath,
})
const expected = { default: [0, 1] }
assert({ actual, expected })
