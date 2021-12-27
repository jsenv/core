import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { require } from "@jsenv/core/src/internal/require.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { buildToCompilationResult } from "@jsenv/core/src/internal/building/buildToCompilationResult.js"
import { GENERATE_COMMONJS_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_COMMONJS.js"

const { SourceMapConsumer } = require("source-map")

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs/`
const mainFilename = `sourcemap_build_commonjs.js`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.cjs",
}

const build = await buildProject({
  ...GENERATE_COMMONJS_BUILD_TEST_PARAMS,
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
})
const compilationResult = buildToCompilationResult(build, {
  projectDirectoryUrl: testDirectoryUrl,
  compiledFileUrl: resolveUrl(
    `${buildDirectoryRelativeUrl}main.js`,
    jsenvCoreDirectoryUrl,
  ),
  sourcemapFileUrl: resolveUrl(
    `${buildDirectoryRelativeUrl}main.js.map`,
    jsenvCoreDirectoryUrl,
  ),
})
const sourceMap = JSON.parse(compilationResult.assetsContent[0])
const sourceMapConsumer = await new SourceMapConsumer(sourceMap)
const actual = sourceMapConsumer.originalPositionFor({
  line: 8,
  column: 0,
  bias: 2,
})
const expected = {
  source: `../../${mainFilename}`,
  line: 2,
  column: actual.column,
  name: null,
}
assert({ actual, expected })
