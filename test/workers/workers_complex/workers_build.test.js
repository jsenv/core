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
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}main.html`]: "main.html",
  },
  workers: {
    [`${testDirectoryRelativeUrl}worker/worker.js`]: "worker_toto_[hash].js",
  },
  serviceWorkers: {
    [`${testDirectoryRelativeUrl}service_worker/sw.js`]: "sw.js",
  },
  classicWorkers: {
    [`${testDirectoryRelativeUrl}classic_worker/worker.js`]:
      "classic_worker_[hash].js",
  },
  classicServiceWorkers: {
    [`${testDirectoryRelativeUrl}classic_service_worker/sw.js`]:
      "classic_sw.js",
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
      url: `${serverOrigin}/dist/esmodule/worker_toto_e8d3de54.js`,
      pingResponse: "pong",
    },
    serviceWorker: {
      url: `${serverOrigin}/dist/esmodule/sw.js`,
      inspectResponse: {
        order: [],
        generatedUrlsConfig: {
          "worker_toto_e8d3de54.js": {
            versioned: true,
          },
          "classic_worker_a850e925.js": {
            versioned: true,
          },
          "classic_sw.js": {
            versioned: false,
            version: "fd3205cd",
          },
          "main.html": {
            versioned: false,
            // because when html file is modified, it's url is not
            // if you update only the html file, browser won't update the service worker.
            // To ensure worker is still updated, jsenv adds a jsenvStaticUrlsHash
            // to include a hash for the html file.
            // -> when html file changes -> hash changes -> worker updates
            version: "1ace3e22",
          },
          "assets/style_b126d686.css": {
            versioned: true,
          },
        },
      },
    },
    classicWorker: {
      url: `${serverOrigin}/dist/esmodule/classic_worker_a850e925.js`,
      pingResponse: "pong",
    },
    classicServiceWorker: {
      url: `${serverOrigin}/dist/esmodule/classic_sw.js`,
      inspectResponse: {
        order: ["before-a", "before-b", "b", "after-b", "after-a"],
        generatedUrlsConfig: {
          "worker_toto_e8d3de54.js": {
            versioned: true,
          },
          "sw.js": {
            versioned: false,
            version: "8c13ad75",
          },
          "classic_worker_a850e925.js": {
            versioned: true,
          },
          "main.html": {
            versioned: false,
            version: "1ace3e22",
          },
          "assets/style_b126d686.css": {
            versioned: true,
          },
        },
      },
    },
  }
  assert({ actual, expected })
}
