import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl, resolveUrl } from "@jsenv/util"
import { require } from "@jsenv/core/src/internal/require.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { buildToCompilationResult } from "@jsenv/core/src/internal/building/buildToCompilationResult.js"
import { buildProject } from "@jsenv/core"
import { GENERATE_COMMONJS_BUILD_TEST_PARAMS } from "../TEST_PARAMS.js"

const { SourceMapConsumer } = require("source-map")

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs/`
const mainFilename = `${testDirectoryname}.js`

const build = await buildProject({
  ...GENERATE_COMMONJS_BUILD_TEST_PARAMS,
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.cjs",
  },
})
const compilationResult = buildToCompilationResult(build, {
  projectDirectoryUrl: testDirectoryUrl,
  compiledFileUrl: resolveUrl(`${buildDirectoryRelativeUrl}main.js`, jsenvCoreDirectoryUrl),
  sourcemapFileUrl: resolveUrl(`${buildDirectoryRelativeUrl}main.js.map`, jsenvCoreDirectoryUrl),
})
const sourceMap = JSON.parse(compilationResult.assetsContent[0])
const sourceMapConsumer = await new SourceMapConsumer(sourceMap)
const actual = sourceMapConsumer.originalPositionFor({ line: 6, column: 0, bias: 2 })
const expected = {
  source: `../../${mainFilename}`,
  line: 2,
  column: actual.column,
  name: null,
}
assert({ actual, expected })
