import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { buildProject } from "@jsenv/core"
import { GENERATE_GLOBAL_BUILD_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs/`
const mainFilename = `${testDirectoryname}.js`

try {
  await buildProject({
    ...GENERATE_GLOBAL_BUILD_TEST_PARAMS,
    babelPluginMap: {},
    // logLevel: "debug",
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    importMapFileRelativeUrl: `${testDirectoryRelativeUrl}test.importmap`,
    entryPointMap: {
      [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.js",
    },
  })
  throw new Error("should throw")
} catch (e) {
  const actual = e.message.includes("import.meta.resolve() not supported with global format")
  const expected = actual
  assert({ actual, expected })
}
