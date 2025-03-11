import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  urlToBasename,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { GENERATE_GLOBAL_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_GLOBAL.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs/`
const mainFilename = `${testDirectoryname}.js`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.js",
}
const importMapFileRelativeUrl = `${testDirectoryRelativeUrl}test.importmap`

try {
  await buildProject({
    ...GENERATE_GLOBAL_BUILD_TEST_PARAMS,
    babelPluginMap: {},
    // logLevel: "debug",
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    importMapFileRelativeUrl,
    entryPointMap,
  })
  throw new Error("should throw")
} catch (e) {
  const actual = e.message.includes(
    "import.meta.resolve() not supported with global format",
  )
  const expected = actual
  assert({ actual, expected })
}
