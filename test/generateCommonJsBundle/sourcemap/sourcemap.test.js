import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl, resolveUrl } from "@jsenv/util"
import { require } from "../../../src/internal/require.js"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { bundleToCompilationResult } from "../../../src/internal/bundling/bundleToCompilationResult.js"
import { generateBundle } from "../../../index.js"
import { GENERATE_COMMONJS_BUNDLE_TEST_PARAMS } from "../TEST_PARAMS.js"

const { SourceMapConsumer } = require("source-map")

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const bundleDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs/`
const mainFilename = `${testDirectoryname}.js`

const bundle = await generateBundle({
  ...GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  bundleDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.cjs",
  },
})
const compilationResult = bundleToCompilationResult(bundle, {
  projectDirectoryUrl: testDirectoryUrl,
  compiledFileUrl: resolveUrl(`${bundleDirectoryRelativeUrl}main.js`, jsenvCoreDirectoryUrl),
  sourcemapFileUrl: resolveUrl(`${bundleDirectoryRelativeUrl}main.js.map`, jsenvCoreDirectoryUrl),
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
