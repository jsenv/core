import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  urlToBasename,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { GENERATE_SYSTEMJS_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import { executeInBrowser } from "@jsenv/core/test/execute_in_browser.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `${testDirectoryname}.js`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.js",
}
const importMapFileRelativeUrl = `${testDirectoryRelativeUrl}test.importmap`

await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  importMapFileRelativeUrl,
  entryPointMap,
})
const { returnValue, serverOrigin } = await executeInBrowser({
  directoryUrl: new URL("./", import.meta.url),
  htmlFileRelativeUrl: "./index.html",
  /* eslint-disable no-undef */
  pageFunction: (jsBuildRelativeUrl) => {
    return window.System.import(jsBuildRelativeUrl)
  },
  /* eslint-enable no-undef */
  pageArguments: [`./main.js`],
})
const actual = returnValue
const expected = {
  basic: `${serverOrigin}/dist/systemjs/file.js`,
  remapped: `${serverOrigin}/bar`,
}
assert({ actual, expected })
