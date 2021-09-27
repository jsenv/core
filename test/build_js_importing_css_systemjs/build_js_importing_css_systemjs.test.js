import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  urlToBasename,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_SYSTEMJS_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${testDirectoryname}.js`]: "./main.js",
}

try {
  await buildProject({
    ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
    useImportMapToMaximizeCacheReuse: false,
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    entryPointMap,
    // logLevel: "debug",
    // minify: true,
  })
  throw new Error("should throw")
} catch (e) {
  const actual = e.message
  const expected = `"text/css" is not a valid type for JavaScript module
--- js module url ---
${testDirectoryUrl}style.css
--- importer url ---
${testDirectoryUrl}${testDirectoryname}.js
--- suggestion ---
non-js ressources can be used with new URL("style.css", import.meta.url)`
  assert({ actual, expected })
}
