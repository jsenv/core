import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_SYSTEMJS_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import { executeInBrowser } from "@jsenv/core/test/execute_in_browser.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const { buildMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPoints: {
    [`./${testDirectoryRelativeUrl}main.html`]: "main.prod.html",
  },
  // logLevel: "debug",
  // minify: true,
})
const jsBuildRelativeUrl = buildMappings[`${testDirectoryRelativeUrl}main.js`]
const cssBuildRelativeUrl =
  buildMappings[`${testDirectoryRelativeUrl}style.css`]

const { returnValue, serverOrigin } = await executeInBrowser({
  directoryUrl: new URL("./", import.meta.url),
  htmlFileRelativeUrl: "./dist/systemjs/main.prod.html",
  /* eslint-disable no-undef */
  pageFunction: (jsBuildRelativeUrl) => {
    return window.System.import(jsBuildRelativeUrl)
  },
  /* eslint-enable no-undef */
  pageArguments: [`./${jsBuildRelativeUrl}`],
})
const actual = returnValue
const expected = {
  cssInstanceOfStylesheet: true,
  cssUrlString: `${serverOrigin}/dist/systemjs/${cssBuildRelativeUrl}`,
}
assert({ actual, expected })
