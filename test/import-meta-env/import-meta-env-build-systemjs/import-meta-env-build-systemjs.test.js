import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import { browserImportSystemJsBuild } from "@jsenv/core/test/browserImportSystemJsBuild.js"
import { buildProject } from "@jsenv/core"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `${testDirectoryname}.js`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.js",
}

await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  importMetaEnvFileRelativeUrl: `${testDirectoryRelativeUrl}env.js`,
  entryPointMap,
})
const { namespace: actual, serverOrigin } = await browserImportSystemJsBuild({
  ...IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
  testDirectoryRelativeUrl,
  htmlFileRelativeUrl: "./index.html",
})
const expected = {
  env: {
    whatever: 42,
    test: true,
  },
  url: `${serverOrigin}/dist/systemjs/main.js`,
}
assert({ actual, expected })
