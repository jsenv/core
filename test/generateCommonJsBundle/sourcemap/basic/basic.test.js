import { basename } from "path"
import { assert } from "@dmail/assert"
import { resolveDirectoryUrl } from "../../../../src/urlHelpers.js"
import { generateCommonJsBundle, bundleToCompilationResult } from "../../../../index.js"
import { importMetaUrlToDirectoryRelativePath } from "../../../importMetaUrlToDirectoryRelativePath.js"
import { COMMONJS_BUNDLING_TEST_GENERATE_PARAM } from "../../commonjs-bundling-test-param.js"

const { SourceMapConsumer } = import.meta.require("source-map")

const testDirectoryRelativePath = importMetaUrlToDirectoryRelativePath(import.meta.url)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const bundleDirectoryRelativePath = `${testDirectoryRelativePath}dist/commonjs`
const mainFileBasename = `${testDirectoryBasename}.js`

const bundle = await generateCommonJsBundle({
  ...COMMONJS_BUNDLING_TEST_GENERATE_PARAM,
  bundleDirectoryRelativePath,
  entryPointMap: {
    main: `${testDirectoryRelativePath}${mainFileBasename}`,
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
  source: `${testDirectoryRelativePath.slice(1)}basic.js`,
  line: 2,
  column: actual.column,
  name: null,
}
assert({ actual, expected })
