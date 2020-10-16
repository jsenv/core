import { basename } from "path"
import { assert } from "@jsenv/assert"
import { urlToRelativeUrl, resolveUrl, readFile } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { babelPluginInstrument } from "../../../src/internal/executing/coverage/babel-plugin-instrument.js"
import { transformJs } from "../../../src/internal/compiling/js-compilation-service/transformJs.js"
import { transformResultToCompilationResult } from "../../../src/internal/compiling/js-compilation-service/transformResultToCompilationResult.js"
import { TRANSFORM_JS_TEST_PARAMS, TRANSFORM_RESULT_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryUrl)
const filename = `${testDirectoryname}.js`
const originalFileUrl = resolveUrl(`./${filename}`, testDirectoryUrl)
const compiledFileUrl = `${jsenvCoreDirectoryUrl}${testDirectoryRelativeUrl}.jsenv/out/${filename}`
const sourcemapFileUrl = `${compiledFileUrl}.map`
const originalFileContent = await readFile(originalFileUrl)

const transformResult = await transformJs({
  ...TRANSFORM_JS_TEST_PARAMS,
  code: originalFileContent,
  url: originalFileUrl,
  babelPluginMap: {
    ...TRANSFORM_RESULT_TEST_PARAMS.babelPluginMap,
    "transform-instrument": [babelPluginInstrument, { projectDirectoryUrl: jsenvCoreDirectoryUrl }],
  },
})
const actual = await transformResultToCompilationResult(transformResult, {
  ...TRANSFORM_RESULT_TEST_PARAMS,
  originalFileContent,
  originalFileUrl,
  compiledFileUrl,
  sourcemapFileUrl,
})
const expected = {
  compiledSource: actual.compiledSource,
  contentType: "application/javascript",
  sources: [originalFileUrl],
  sourcesContent: [originalFileContent],
  assets: [sourcemapFileUrl, `${compiledFileUrl}__asset__coverage.json`],
  assetsContent: [actual.assetsContent[0], actual.assetsContent[1]],
}
assert({ actual, expected })
