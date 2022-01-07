import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import { browserImportSystemJsBuild } from "@jsenv/core/test/browserImportSystemJsBuild.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const { projectBuildMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPoints: {
    [`./${testDirectoryRelativeUrl}main.html`]: "main.prod.html",
  },
  // logLevel: "debug",
  // minify: true,
})
const jsBuildRelativeUrl =
  projectBuildMappings[`${testDirectoryRelativeUrl}main.js`]
const cssBuildRelativeUrl =
  projectBuildMappings[`${testDirectoryRelativeUrl}style.css`]

const { namespace, serverOrigin } = await browserImportSystemJsBuild({
  ...IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
  testDirectoryRelativeUrl,
  htmlFileRelativeUrl: "./dist/systemjs/main.prod.html",
  mainRelativeUrl: `./${jsBuildRelativeUrl}`,
})

const actual = namespace
const expected = {
  cssInstanceOfStylesheet: true,
  cssUrlString: `${serverOrigin}/dist/systemjs/${cssBuildRelativeUrl}`,
}
assert({ actual, expected })
