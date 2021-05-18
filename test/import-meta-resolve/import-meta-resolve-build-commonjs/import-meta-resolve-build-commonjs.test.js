import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl, urlToBasename } from "@jsenv/util"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_COMMONJS_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_COMMONJS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs`
const mainFilename = `${testDirectoryname}.js`

try {
  await buildProject({
    ...GENERATE_COMMONJS_BUILD_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    importMapFileRelativeUrl: `${testDirectoryRelativeUrl}test.importmap`,
    entryPointMap: {
      [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.cjs",
    },
  })
  throw new Error("should throw")
} catch (e) {
  const actual = e.message.includes("import.meta.resolve() not supported with commonjs format")
  const expected = actual
  assert({ actual, expected })
}

// const { namespace } = await requireCommonJsBuild({
//   ...REQUIRE_COMMONJS_BUILD_TEST_PARAMS,
//   buildDirectoryRelativeUrl,
// })
// const actual = {
//   relative: await namespace.relative,
//   bareA: await namespace.bareA,
//   bareB: await namespace.bareB,
// }
// const expected = {
//   relative: resolveUrl(`${buildDirectoryRelativeUrl}/file.js`, jsenvCoreDirectoryUrl),
//   bareA: resolveUrl(`${buildDirectoryRelativeUrl}/bar`, jsenvCoreDirectoryUrl),
//   bareB: "file:///bar",
// }
// assert({ actual, expected })
