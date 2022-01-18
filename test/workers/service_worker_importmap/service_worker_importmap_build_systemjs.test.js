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
await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPoints: {
    [`./${testDirectoryRelativeUrl}main.html`]: "main.html",
  },
  serviceWorkers: [`${testDirectoryRelativeUrl}service_worker.js`],
})
const { returnValue } = await executeInBrowser({
  directoryUrl: new URL("./", import.meta.url),
  htmlFileRelativeUrl: "./dist/systemjs/main.html",
  /* eslint-disable no-undef */
  pageFunction: async () => {
    return window.namespacePromise
  },
  /* eslint-enable no-undef */
})
const actual = returnValue
const expected = {
  serviceWorker: {
    value: 42,
    inspectResponse: 42,
  },
}
assert({ actual, expected })
