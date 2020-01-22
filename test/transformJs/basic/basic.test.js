import { basename } from "path"
import { assert } from "@jsenv/assert"
import { urlToRelativeUrl, resolveUrl, readFile } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { transformJs } from "../../../src/internal/compiling/js-compilation-service/transformJs.js"
import { transformResultToCompilationResult } from "../../../src/internal/compiling/js-compilation-service/transformResultToCompilationResult.js"
import { TRANSFORM_JS_TEST_PARAMS, TRANSFORM_RESULT_TEST_PARAMS } from "../TEST_PARAMS.js"

// eslint-disable-next-line import/newline-after-import
;(async () => {
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
  })
  const compilationResult = await transformResultToCompilationResult(transformResult, {
    ...TRANSFORM_RESULT_TEST_PARAMS,
    originalFileContent,
    originalFileUrl,
    compiledFileUrl,
    sourcemapFileUrl,
  })
  {
    const actual = compilationResult
    const expected = {
      compiledSource: actual.compiledSource,
      contentType: "application/javascript",
      sources: [`../../../${filename}`],
      sourcesContent: [originalFileContent],
      assets: [`../${filename}.map`],
      assetsContent: [actual.assetsContent[0]],
    }
    assert({ actual, expected })
  }
  {
    const actual = JSON.parse(compilationResult.assetsContent[0])
    const expected = {
      version: 3,
      sources: [`../../${filename}`],
      names: actual.names,
      mappings: actual.mappings,
    }
    assert({ actual, expected })
  }
})()
