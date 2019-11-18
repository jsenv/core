import { readFileSync } from "fs"
import { basename } from "path"
import { assert } from "@jsenv/assert"
import { fileUrlToPath, urlToRelativeUrl, resolveDirectoryUrl } from "src/internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "src/internal/jsenvCoreDirectoryUrl.js"
import { transformJs } from "src/internal/compile-server/js-compilation-service/transformJs.js"
import { transformResultToCompilationResult } from "src/internal/compile-server/js-compilation-service/transformResultToCompilationResult.js"
import { TRANSFORM_JS_TEST_PARAMS, TRANSFORM_RESULT_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryBasename = basename(testDirectoryUrl)
const fileBasename = `${testDirectoryBasename}.js`
const fileUrl = import.meta.resolve(`./${fileBasename}`)
const fileRelativeUrl = urlToRelativeUrl(fileUrl, jsenvCoreDirectoryUrl)
const filePath = fileUrlToPath(fileUrl)
const fileContent = readFileSync(filePath).toString()

const transformResult = await transformJs({
  ...TRANSFORM_JS_TEST_PARAMS,
  code: fileContent,
  url: fileUrl,
})
const actual = transformResultToCompilationResult(transformResult, {
  ...TRANSFORM_RESULT_TEST_PARAMS,
  source: fileContent,
  sourceUrl: fileUrl,
})
const expected = {
  compiledSource: actual.compiledSource,
  contentType: "application/javascript",
  sources: [fileRelativeUrl],
  sourcesContent: [fileContent],
  assets: [`${fileBasename}.map`],
  assetsContent: [actual.assetsContent[0]],
}
assert({ actual, expected })
