import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_GLOBAL_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_GLOBAL.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/global/`
const mainFilename = `dynamic_import_without_top_level_await.js`

try {
  await buildProject({
    ...GENERATE_GLOBAL_BUILD_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    entryPointMap: {
      [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.js",
    },
  })
} catch (actual) {
  const expected = new Error(
    `UMD and IIFE output formats are not supported for code-splitting builds.`,
  )
  expected.code = "INVALID_OPTION"
  assert({ actual, expected })
}
