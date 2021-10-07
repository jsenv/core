import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_SYSTEMJS_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}main.html`]: "./main.html",
}
const jsonFileUrl = resolveUrl("./file.json", import.meta.url)
const jsFileUrl = resolveUrl("./main.js", import.meta.url)

try {
  await buildProject({
    ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    entryPointMap,
    minify: true,
  })
  throw new Error("should throw")
} catch (e) {
  const actual = e.message
  const expected = `"application/json" is not a valid type for JavaScript module
--- js module url ---
${jsonFileUrl}
--- importer url ---
${jsFileUrl}
--- suggestion ---
non-js ressources can be used with new URL("file.json", import.meta.url)`
  assert({ actual, expected })
}
