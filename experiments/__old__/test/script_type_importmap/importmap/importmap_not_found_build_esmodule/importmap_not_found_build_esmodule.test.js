import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const importMapFileRelativeUrl = "./not-found.importmap"
const importMapFileUrl = resolveUrl(
  importMapFileRelativeUrl,
  jsenvCoreDirectoryUrl,
)
try {
  await buildProject({
    ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
    importMapFileRelativeUrl,
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    entryPoints: {
      [`./${testDirectoryRelativeUrl}importmap_not_found_build_esmodule.js`]:
        "main.js",
    },
  })
} catch (e) {
  const actual = e.message
  const expected = `invalid response status on url
--- response status ---
404
--- url ---
${importMapFileUrl}
--- url trace ---
importMapFileRelativeUrl parameter
--- response text ---
`
  assert({ actual, expected })
}
