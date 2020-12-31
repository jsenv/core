import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_COMMONJS_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_COMMONJS.js"
import { buildProject } from "@jsenv/core"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs/`
const mainFilename = `${testDirectoryname}.js`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.cjs",
}

try {
  await buildProject({
    ...GENERATE_COMMONJS_BUILD_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    entryPointMap,
  })
} catch (actual) {
  process.exitCode = undefined // restore process exitCode set by error in buildProject
  const expected = new Error(
    `Module format cjs does not support top-level await. Use the "es" or "system" output formats rather.`,
  )
  expected.code = "INVALID_TLA_FORMAT"
  assert({ actual, expected })
}
