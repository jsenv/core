/**

External urls are left untouched.
In the case of commonjs build it means they becomes
require(url)
Which ends up in MODULE_NOT_FOUND error

*/

import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, resolveUrl, urlToRelativeUrl, readFile } from "@jsenv/filesystem"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { buildToCompilationResult } from "@jsenv/core/src/internal/building/buildToCompilationResult.js"
import {
  GENERATE_COMMONJS_BUILD_TEST_PARAMS,
  REQUIRE_COMMONJS_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_COMMONJS.js"
import { requireCommonJsBuild } from "@jsenv/core/test/requireCommonJsBuild.js"
import { buildProject } from "@jsenv/core"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs/`
const mainFilename = `${testDirectoryname}.js`
const mainFileRelativeUrl = `./${testDirectoryRelativeUrl}${mainFilename}`
const mainFileUrl = resolveUrl(mainFilename, import.meta.url)

const build = await buildProject({
  ...GENERATE_COMMONJS_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [mainFileRelativeUrl]: "./main.cjs",
  },
})
const sourcemapFileUrl = resolveUrl(
  `${buildDirectoryRelativeUrl}main.cjs.map`,
  jsenvCoreDirectoryUrl,
)
const compilationResult = buildToCompilationResult(build, {
  projectDirectoryUrl: testDirectoryUrl,
  compiledFileUrl: resolveUrl(`${buildDirectoryRelativeUrl}main.cjs`, jsenvCoreDirectoryUrl),
  sourcemapFileUrl,
})
{
  const actual = compilationResult
  const expected = {
    contentType: "application/javascript",
    compiledSource: actual.compiledSource,
    sources: [mainFileUrl],
    sourcesContent: [await readFile(mainFileUrl)],
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
    sources: [`../../${testDirectoryname}.js`],
    sourcesContent: [await readFile(mainFileUrl)],
    names: actual.names,
    mappings: actual.mappings,
  }
  assert({ actual, expected })
}

try {
  await requireCommonJsBuild({
    ...REQUIRE_COMMONJS_BUILD_TEST_PARAMS,
    buildDirectoryRelativeUrl,
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
