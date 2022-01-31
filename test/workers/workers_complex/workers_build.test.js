import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { buildProject, jsenvServiceWorkerFinalizer } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { executeInBrowser } from "@jsenv/core/test/execute_in_browser.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPoints: {
    [`./${testDirectoryRelativeUrl}main.html`]: "main.html",
  },
  serviceWorkerFinalizer: jsenvServiceWorkerFinalizer,
})
const { returnValue, serverOrigin } = await executeInBrowser({
  directoryUrl: new URL("./", import.meta.url),
  htmlFileRelativeUrl: "./dist/esmodule/main.html",
  /* eslint-disable no-undef */
  pageFunction: async () => {
    return window.namespacePromise
  },
  /* eslint-enable no-undef */
})
if (process.platform !== "win32") {
  const actual = returnValue
  const expected = {
    worker: {
      url: `${serverOrigin}/dist/esmodule/worker_e8d3de54.js`,
      pingResponse: "pong",
    },
    serviceWorker: {
      url: `${serverOrigin}/dist/esmodule/sw.js`,
      inspectResponse: {
        order: [],
        generatedUrlsConfig: {
          "assets/style_b126d686.css": {
            versioned: true,
          },
          "main.html": {
            versioned: false,
            // because when html file is modified, it's url is not
            // if you update only the html file, browser won't update the service worker.
            // To ensure worker is still updated, jsenv adds a jsenvStaticUrlsHash
            // to include a hash for the html file.
            // -> when html file changes -> hash changes -> worker updates
            version: "0c9567da",
          },
          "sw2.js": {
            versioned: false,
            version: "148f0aa7",
          },
          "worker_e8d3de54.js": {
            versioned: true,
          },
          "worker2_a850e925.js": {
            versioned: true,
          },
        },
      },
    },
    classicWorker: {
      url: `${serverOrigin}/dist/esmodule/worker2_a850e925.js`,
      pingResponse: "pong",
    },
    classicServiceWorker: {
      url: `${serverOrigin}/dist/esmodule/sw2.js`,
      inspectResponse: {
        order: ["before-a", "before-b", "b", "after-b", "after-a"],
        generatedUrlsConfig: {
          "assets/style_b126d686.css": {
            versioned: true,
          },
          "main.html": {
            versioned: false,
            version: "0c9567da",
          },
          "sw.js": {
            versioned: false,
            version: "8c13ad75",
          },
          "worker_e8d3de54.js": {
            versioned: true,
          },
          "worker2_a850e925.js": {
            versioned: true,
          },
        },
      },
    },
  }
  assert({ actual, expected })
}
