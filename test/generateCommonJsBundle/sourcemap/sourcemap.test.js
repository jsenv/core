import { basename } from "path"
import { assert } from "@jsenv/assert"
import { generateCommonJsBundle } from "../../../index.js"
import { bundleToCompilationResult } from "src/internal/bundle/bundleToCompilationResult.js"
import { resolveDirectoryUrl, fileUrlToRelativePath } from "src/internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_COMMONJS_BUNDLE_TEST_PARAMS } from "../TEST_PARAMS.js"

const { SourceMapConsumer } = import.meta.require("source-map")

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = fileUrlToRelativePath(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const bundleDirectoryRelativePath = `${testDirectoryRelativePath}dist/commonjs`
const mainFileBasename = `${testDirectoryBasename}.js`

const bundle = await generateCommonJsBundle({
  ...GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  bundleDirectoryRelativePath,
  entryPointMap: {
    main: `./${testDirectoryRelativePath}${mainFileBasename}`,
  },
  writeOnFileSystem: true,
})
const compilationResult = bundleToCompilationResult(bundle, {
  projectDirectoryUrl: resolveDirectoryUrl("./", import.meta.url),
})

const sourceMap = JSON.parse(compilationResult.assetsContent[0])
const sourceMapConsumer = await new SourceMapConsumer(sourceMap)
const actual = sourceMapConsumer.originalPositionFor({ line: 6, column: 0, bias: 2 })
const expected = {
  source: `/${testDirectoryRelativePath}${mainFileBasename}`,
  line: 2,
  column: actual.column,
  name: null,
}
assert({ actual, expected })
