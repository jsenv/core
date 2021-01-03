import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_COMMONJS_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_COMMONJS.js"
import { buildProject } from "@jsenv/core"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs`
const mainFilename = `${testDirectoryname}.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${mainFilename}`
const entryPointMap = {
  [`./${fileRelativeUrl}`]: "./main.cjs",
}
const importMapFileRelativeUrl = `${testDirectoryRelativeUrl}import-map.importmap`

try {
  await buildProject({
    ...GENERATE_COMMONJS_BUILD_TEST_PARAMS,
    compileServerPort: 4567,
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    importMapFileRelativeUrl,
    entryPointMap,
  })
  throw new Error("should throw")
} catch (e) {
  const actual = e.message
  const expected = `Unmapped bare specifier.
--- specifier ---
foo
--- importer ---
${fileRelativeUrl}
--- how to fix ---
Add a mapping for "foo" into the importmap file at ${importMapFileRelativeUrl}
--- suggestion ---
Generate importmap using https://github.com/jsenv/jsenv-node-module-import-map`
  assert({ actual, expected })
}
