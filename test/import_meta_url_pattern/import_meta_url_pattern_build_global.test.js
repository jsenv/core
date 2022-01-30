import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_GLOBAL_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_GLOBAL.js"
import { executeFileUsingBrowserScript } from "@jsenv/core/test/execution_with_browser_script.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/global/`
await buildProject({
  ...GENERATE_GLOBAL_BUILD_TEST_PARAMS,
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl: `${testDirectoryRelativeUrl}.jsenv/`,
  buildDirectoryRelativeUrl,
  entryPoints: {
    [`./${testDirectoryRelativeUrl}index.js`]: "main.js",
  },
  globals: {
    [`./${testDirectoryRelativeUrl}index.js`]: "__namespace__",
  },
})
const { returnValue, serverOrigin } = await executeFileUsingBrowserScript({
  rootDirectoryUrl: resolveUrl(
    buildDirectoryRelativeUrl,
    jsenvCoreDirectoryUrl,
  ),
  jsFileRelativeUrl: "./main.js",
  /* eslint-disable no-undef */
  pageFunction: async () => {
    const { jsUrlInstanceOfUrl, jsUrlString, modulePromise } =
      window.__namespace__
    const moduleNamespace = await modulePromise
    return {
      jsUrlInstanceOfUrl,
      jsUrlString,
      moduleNamespace,
    }
  },
  /* eslint-enable no-undef */
})
const { jsUrlInstanceOfUrl, jsUrlString, moduleNamespace } = returnValue
const actual = {
  jsUrlInstanceOfUrl,
  jsUrlString,
  moduleNamespace,
}
const expected = {
  jsUrlInstanceOfUrl: true,
  jsUrlString: String(new URL(`./assets/file_ddacbcda.js`, serverOrigin)),
  moduleNamespace: "DYNAMIC_IMPORT_POLYFILL_RETURN_VALUE",
}
assert({ actual, expected })
