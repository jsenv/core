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
const originalFileUrl = resolveUrl(`./empty.js`, testDirectoryUrl)
const compiledFileUrl = `${jsenvCoreDirectoryUrl}${testDirectoryRelativeUrl}.jsenv/out/empty.js`
const sourcemapFileUrl = `${compiledFileUrl}.map`
const originalFileContent = await readFile(originalFileUrl)

const transformResult = await transformWithBabel({
  ...TRANSFORM_JS_TEST_PARAMS,
  url: originalFileUrl,
  content: originalFileContent,
})
const actual = await asCompilationResult(
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
const expected = {
  contentType: "application/javascript",
  content: actual.content,
  sourcemap: assert.any(Object),
  sources: [originalFileUrl],
  sourcesContent: [originalFileContent],
  assets: [sourcemapFileUrl],
  assetsContent: [actual.assetsContent[0]],
  dependencies: [],
}
assert({ actual, expected })
