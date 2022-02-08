import { urlToRelativeUrl, resolveUrl, readFile } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { asCompilationResult } from "@jsenv/core/src/internal/compile_server/jsenv_directory/compilation_result.js"
import { transformWithBabel } from "@jsenv/core/src/internal/transform_js/transform_with_babel.js"
import {
  TRANSFORM_JS_TEST_PARAMS,
  TRANSFORM_RESULT_TEST_PARAMS,
} from "../TEST_PARAMS_TRANSFORM_JS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const sourceFileUrl = resolveUrl(`./basic.js`, testDirectoryUrl)
const compiledFileUrl = `${jsenvCoreDirectoryUrl}${testDirectoryRelativeUrl}.jsenv/out/basic.js`
const sourcemapFileUrl = `${compiledFileUrl}.map`
const originalFileContent = await readFile(sourceFileUrl)

const transformResult = await transformWithBabel({
  ...TRANSFORM_JS_TEST_PARAMS,
  url: sourceFileUrl,
  content: originalFileContent,
})
const compilationResult = await asCompilationResult(
  {
    contentType: "application/javascript",
    ...transformResult,
  },
  {
    ...TRANSFORM_RESULT_TEST_PARAMS,
    originalFileContent,
    sourceFileUrl,
    compiledFileUrl,
    sourcemapFileUrl,
  },
)
{
  const actual = compilationResult
  const expected = {
    contentType: "application/javascript",
    content: actual.content,
    sourcemap: assert.any(Object),
    sources: [sourceFileUrl],
    sourcesContent: [originalFileContent],
    assets: [sourcemapFileUrl],
    assetsContent: [actual.assetsContent[0]],
    dependencies: [],
  }
  assert({ actual, expected })
}
{
  const actual = JSON.parse(compilationResult.assetsContent[0])
  const expected = {
    version: 3,
    sources: [`../../basic.js`],
    names: actual.names,
    mappings: actual.mappings,
  }
  assert({ actual, expected })
}
