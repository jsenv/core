import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { buildProject, jsenvServiceWorkerFinalizer } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  BROWSER_IMPORT_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { browserImportEsModuleBuild } from "@jsenv/core/test/browserImportEsModuleBuild.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}main.html`]: "./main.html",
  },
  workers: {
    [`${testDirectoryRelativeUrl}worker/worker.js`]: "worker.js",
  },
  serviceWorkers: {
    [`${testDirectoryRelativeUrl}service_worker/sw.js`]: "sw.js",
  },
  classicWorkers: {
    [`${testDirectoryRelativeUrl}classic_worker/worker.js`]: "worker.js",
  },
  classicServiceWorkers: {
    [`${testDirectoryRelativeUrl}classic_service_worker/sw.js`]: "sw.js",
  },
  serviceWorkerFinalizer: jsenvServiceWorkerFinalizer,
})

const { namespace, serverOrigin } = await browserImportEsModuleBuild({
  ...BROWSER_IMPORT_BUILD_TEST_PARAMS,
  testDirectoryRelativeUrl,
  codeToRunInBrowser: "window.namespacePromise",
  // debug: true,
})

if (process.platform !== "win32") {
  const actual = namespace
  const expected = {
    worker: {
      url: `${serverOrigin}/dist/esmodule/assets/worker-a850e925.js`,
      pingResponse: `pong`,
    },
    serviceWorker: {
      url: `${serverOrigin}/dist/esmodule/sw.js`,
      inspectResponse: {
        order: ["before-a", "before-b", "b", "after-b", "after-a"],
        generatedUrlsConfig: {
          "assets/worker-a850e925.js": {
            versioned: true,
          },
          "main.html": {
            versioned: false,
            // because when html file is modified, it's url is not
            // if you update only the html file, browser won't update the service worker.
            // To ensure worker is still updated, jsenv adds a jsenvStaticUrlsHash
            // to include a hash for the html file.
            // -> when html file changes -> hash changes -> worker updates
            version: "03c933a5",
          },
          "assets/style-b126d686.css": {
            versioned: true,
          },
        },
      },
    },
  }
  assert({ actual, expected })
}
