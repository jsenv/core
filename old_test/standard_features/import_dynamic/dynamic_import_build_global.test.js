import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { GENERATE_GLOBAL_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_GLOBAL.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/global/`

try {
  await buildProject({
    ...GENERATE_GLOBAL_BUILD_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    entryPoints: {
      [`./${testDirectoryRelativeUrl}dynamic_import_without_top_level_await.js`]:
        "main.js",
    },
    globals: {
      [`./${testDirectoryRelativeUrl}dynamic_import_without_top_level_await.js`]:
        "__namespace__",
    },
  })
} catch (actual) {
  const expected = new Error(
    `Invalid value "iife" for option "output.format" - UMD and IIFE output formats are not supported for code-splitting builds.`,
  )
  expected.code = "INVALID_OPTION"
  expected.url = "https://rollupjs.org/guide/en/#outputformat"
  assert({ actual, expected })
}
