import { basename } from "path"
import { assert } from "@jsenv/assert"
import { generateGlobalBundle } from "../../../index.js"
import { resolveDirectoryUrl, urlToRelativePath } from "src/internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_GLOBAL_BUNDLE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativePath(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const bundleDirectoryRelativePath = `${testDirectoryRelativePath}dist/commonjs/`
const mainFileBasename = `${testDirectoryBasename}.js`

try {
  await generateGlobalBundle({
    ...GENERATE_GLOBAL_BUNDLE_TEST_PARAMS,
    bundleDirectoryRelativePath,
    entryPointMap: {
      main: `${testDirectoryRelativePath}${mainFileBasename}`,
    },
  })
} catch (actual) {
  const expected = new Error(
    "UMD and IIFE output formats are not supported for code-splitting builds.",
  )
  expected.code = "INVALID_OPTION"
  assert({ actual, expected })
}
