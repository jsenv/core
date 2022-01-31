import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  urlToBasename,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { executeInBrowser } from "@jsenv/core/test/execute_in_browser.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const mainFilename = `${testDirectoryname}.html`
const { buildMappings } = await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPoints: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "main.html",
  },
})
const jsBuildRelativeUrl =
  buildMappings[`${testDirectoryRelativeUrl}import_meta_url.js`]
const { returnValue, serverOrigin } = await executeInBrowser({
  directoryUrl: new URL("./", import.meta.url),
  htmlFileRelativeUrl: "./dist/esmodule/main.html",
  /* eslint-disable no-undef */
  pageFunction: async (jsBuildRelativeUrl) => {
    const namespace = await import(jsBuildRelativeUrl)
    return namespace
  },
  /* eslint-enable no-undef */
  pageArguments: [`./${jsBuildRelativeUrl}`],
})
const actual = returnValue
const expected = {
  isInstanceOfUrl: false,
  urlString: `${serverOrigin}/dist/esmodule/${jsBuildRelativeUrl}`,
}
assert({ actual, expected })
