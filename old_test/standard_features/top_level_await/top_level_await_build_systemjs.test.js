import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, readFile } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { GENERATE_SYSTEMJS_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import { executeInBrowser } from "@jsenv/core/test/execute_in_browser.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const entryPoints = {
  [`./${testDirectoryRelativeUrl}top_level_await.html`]: "main.html",
}
const { buildMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPoints,
  // logLevel: "debug",
})
const jsBuildRelativeUrl =
  buildMappings[`${testDirectoryRelativeUrl}top_level_await.js`]
const fileContent = await readFile(
  new URL(`./dist/systemjs/${jsBuildRelativeUrl}`, import.meta.url),
)
const { returnValue } = await executeInBrowser({
  directoryUrl: new URL("./", import.meta.url),
  htmlFileRelativeUrl: "./dist/systemjs/main.html",
  /* eslint-disable no-undef */
  pageFunction: (jsBuildRelativeUrl) => {
    return window.System.import(jsBuildRelativeUrl)
  },
  /* eslint-enable no-undef */
  pageArguments: [`./${jsBuildRelativeUrl}`],
})
const actual = {
  containsAsync: fileContent.includes("async function"),
  returnValue,
}
const expected = {
  containsAsync: false,
  returnValue: { value: 42 },
}
assert({ actual, expected })
