/**

External urls are left untouched.
In the case of commonjs bundle it means they becomes
require(url)
Which ends up in MODULE_NOT_FOUND error

*/

import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { bundleToCompilationResult } from "../../../src/internal/bundling/bundleToCompilationResult.js"
import { generateBundle } from "../../../index.js"
import { requireCommonJsBundle } from "../requireCommonJsBundle.js"
import {
  GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const bundleDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs/`
const mainFilename = `${testDirectoryname}.js`

const bundle = await generateBundle({
  ...GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  bundleDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.cjs",
  },
})
const sourcemapFileUrl = resolveUrl(
  `${bundleDirectoryRelativeUrl}main.cjs.map`,
  jsenvCoreDirectoryUrl,
)
const compilationResult = bundleToCompilationResult(bundle, {
  projectDirectoryUrl: testDirectoryUrl,
  compiledFileUrl: resolveUrl(`${bundleDirectoryRelativeUrl}main.cjs`, jsenvCoreDirectoryUrl),
  sourcemapFileUrl,
})
{
  const actual = compilationResult
  const expected = {
    contentType: "application/javascript",
    compiledSource: actual.compiledSource,
    sources: [],
    sourcesContent: [],
    assets: [sourcemapFileUrl],
    assetsContent: [actual.assetsContent[0]],
  }
  assert({ actual, expected })
}
{
  const actual = JSON.parse(compilationResult.assetsContent[0])
  const expected = {
    version: actual.version,
    file: "main.cjs",
    sources: [],
    sourcesContent: [],
    names: actual.names,
    mappings: actual.mappings,
  }
  assert({ actual, expected })
}

try {
  await requireCommonJsBundle({
    ...REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
    bundleDirectoryRelativeUrl,
  })
} catch (e) {
  const actual = {
    code: e.code,
  }
  const expected = {
    code: "MODULE_NOT_FOUND",
  }
  assert({ actual, expected })
}
