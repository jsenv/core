import { assert } from "@jsenv/assert"
import { urlToRelativeUrl, resolveUrl, readFile } from "@jsenv/filesystem"

import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { transformResultToCompilationResult } from "@jsenv/core/src/internal/compiling/transformResultToCompilationResult.js"
import { transformJs } from "@jsenv/core/src/internal/compiling/js-compilation-service/transformJs.js"
import {
  TRANSFORM_JS_TEST_PARAMS,
  TRANSFORM_RESULT_TEST_PARAMS,
} from "../TEST_PARAMS_TRANSFORM_JS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const filename = `basic.js`
const originalFileUrl = resolveUrl(`./${filename}`, testDirectoryUrl)
const compiledFileUrl = `${jsenvCoreDirectoryUrl}${testDirectoryRelativeUrl}.jsenv/out/${filename}`
const sourcemapFileUrl = `${compiledFileUrl}.map`
const originalFileContent = await readFile(originalFileUrl)

const transformResult = await transformJs({
  ...TRANSFORM_JS_TEST_PARAMS,
  code: originalFileContent,
  url: originalFileUrl,
})
const compilationResult = await transformResultToCompilationResult(
  {
    contentType: "application/javascript",
    ...transformResult,
  },
  {
    ...TRANSFORM_RESULT_TEST_PARAMS,
    originalFileContent,
    originalFileUrl,
    compiledFileUrl,
    sourcemapFileUrl,
  },
)
{
  const actual = compilationResult
  const expected = {
    contentType: "application/javascript",
    compiledSource: actual.compiledSource,
    sourcemap: assert.any(Object),
    sources: [originalFileUrl],
    sourcesContent: [originalFileContent],
    assets: [sourcemapFileUrl],
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
