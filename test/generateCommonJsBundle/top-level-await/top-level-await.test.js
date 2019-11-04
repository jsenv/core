import { basename } from "path"
import { assert } from "@dmail/assert"
import { generateCommonJsBundle } from "../../../index.js"
import { resolveDirectoryUrl, fileUrlToRelativePath } from "src/private/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "src/private/jsenvCoreDirectoryUrl.js"
import { GENERATE_COMMONJS_BUNDLE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = fileUrlToRelativePath(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const bundleDirectoryRelativePath = `${testDirectoryRelativePath}dist/commonjs`
const mainFileBasename = `${testDirectoryBasename}.js`

try {
  await generateCommonJsBundle({
    ...GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
    bundleDirectoryRelativePath,
    entryPointMap: {
      main: `${testDirectoryRelativePath}${mainFileBasename}`,
    },
  })
} catch (actual) {
  const expected = new Error(
    `Module format cjs does not support top-level await. Use the "es" or "system" output formats rather.`,
  )
  expected.code = "INVALID_TLA_FORMAT"
  assert({ actual, expected })
}
