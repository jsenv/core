import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
} from "@jsenv/filesystem"

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
const mainFilename = `main.html`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.html",
}
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)

await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
  workers: {
    [`${testDirectoryRelativeUrl}worker/worker.js`]: "worker.js",
  },
  serviceWorkers: {
    [`${testDirectoryRelativeUrl}service_worker/sw.js`]: "sw.js",
  },
  serviceWorkerFinalizer: jsenvServiceWorkerFinalizer,
})

const { namespace, serverOrigin } = await browserImportEsModuleBuild({
  ...BROWSER_IMPORT_BUILD_TEST_PARAMS,
  testDirectoryRelativeUrl,
  codeToRunInBrowser: "window.namespace",
  // debug: true,
})

const actual = namespace
const expected = {
  workerUrl: `${serverOrigin}/worker.js`,
  pingResponse: ``,
  serviceWorkerUrl: `${serverOrigin}/sw.js`,
  inspectResponse: {
    order: ["before-a", "before-b", "b", "after-b", "after-a"],
    jsenvBuildUrls: {
      "assets/style-b126d686.css": { versioned: true },
      "main.html": {
        versioned: false,
        // because when html file is modified, it's url is not
        // if you update only the html file, browser won't update the service worker.
        // To ensure worker is still updated, jsenv adds a jsenvStaticUrlsHash
        // to include a hash for the html file.
        // -> when html file changes -> hash changes -> worker updates
        version: "9baaa6c1",
      },
    },
  },
}
assert({ actual, expected })
