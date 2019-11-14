import { readFileSync } from "fs"
import { basename } from "path"
import { assert } from "@dmail/assert"
import { createInstrumentBabelPlugin } from "@jsenv/testing/src/coverage/instrument-babel-plugin.js"
import { fileUrlToPath, fileUrlToRelativePath, resolveDirectoryUrl } from "src/internal/urlUtils.js"
import { transformJs } from "src/internal/compile-server/js-compilation-service/transformJs.js"
import { transformResultToCompilationResult } from "src/internal/compile-server/js-compilation-service/transformResultToCompilationResult.js"
import { TRANSFORM_JS_TEST_PARAMS, TRANSFORM_RESULT_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryBasename = basename(testDirectoryUrl)
const fileBasename = `${testDirectoryBasename}.js`
const fileUrl = import.meta.resolve(`./${fileBasename}`)
const fileRelativePath = fileUrlToRelativePath(
  fileUrl,
  TRANSFORM_JS_TEST_PARAMS.projectDirectoryUrl,
)
const filePath = fileUrlToPath(fileUrl)
const fileContent = readFileSync(filePath).toString()

const transformResult = await transformJs({
  ...TRANSFORM_JS_TEST_PARAMS,
  code: fileContent,
  url: fileUrl,
  babelPluginMap: {
    ...TRANSFORM_RESULT_TEST_PARAMS.babelPluginMap,
    "transform-instrument": [createInstrumentBabelPlugin()],
  },
})
const actual = transformResultToCompilationResult(transformResult, {
  ...TRANSFORM_RESULT_TEST_PARAMS,
  source: fileContent,
  sourceUrl: fileUrl,
})
const expected = {
  compiledSource: actual.compiledSource,
  contentType: "application/javascript",
  sources: [fileRelativePath],
  sourcesContent: [fileContent],
  assets: [`${fileBasename}.map`, "coverage.json"],
  assetsContent: [actual.assetsContent[0], actual.assetsContent[1]],
}
assert({ actual, expected })
