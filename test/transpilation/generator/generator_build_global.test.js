import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  resolveUrl,
  urlToRelativeUrl,
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
  jsenvDirectoryRelativeUrl: `${testDirectoryRelativeUrl}.jsenv/`,
  buildDirectoryRelativeUrl,
  entryPoints: {
    [`./${testDirectoryRelativeUrl}main.js`]: "main.js",
  },
  globals: {
    [`./${testDirectoryRelativeUrl}main.js`]: "__namespace__",
  },
})
const { returnValue } = await executeFileUsingBrowserScript({
  rootDirectoryUrl: resolveUrl(
    buildDirectoryRelativeUrl,
    jsenvCoreDirectoryUrl,
  ),
  jsFileRelativeUrl: "./main.js",
  /* eslint-disable no-undef */
  pageFunction: () => window.__namespace__,
  /* eslint-enable no-undef */
})
const actual = returnValue
const expected = { value: [0, 1] }
assert({ actual, expected })
