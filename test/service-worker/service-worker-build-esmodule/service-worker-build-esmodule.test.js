import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl, resolveUrl, urlToFileSystemPath } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { require } from "@jsenv/core/src/internal/require.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { buildProject, jsenvServiceWorkerFinalizer } from "@jsenv/core"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const mainFilename = `${testDirectoryname}.html`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.html",
}

await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
  serviceWorkers: {
    [`${testDirectoryRelativeUrl}sw.js`]: "sw.cjs",
  },
  serviceWorkerFinalizer: jsenvServiceWorkerFinalizer,
  // minify: true,
})

if (process.platform !== "win32") {
  // hash differ because of line endings
  const buildDirectoryUrl = resolveUrl(buildDirectoryRelativeUrl, jsenvCoreDirectoryUrl)
  const serviceWorkerBuildUrl = resolveUrl("sw.cjs", buildDirectoryUrl)
  global.self = {}
  // eslint-disable-next-line import/no-dynamic-require
  require(urlToFileSystemPath(serviceWorkerBuildUrl))
  const actual = global.self
  const expected = {
    generatedUrlsConfig: {
      "assets/style-b126d686.css": { versioned: true },
      [`${testDirectoryname}.11-4f59ed7a.js`]: { versioned: true },
      "main.html": {
        versioned: false,
        // because when html file is modified, it's url is not
        // if you update only the html file, browser won't update the service worker.
        // To ensure worker is still updated, jsenv adds a jsenvStaticUrlsHash
        // to include a hash for the html file.
        // -> when html file changes -> hash changes -> worker updates
        version: "c690629a",
      },
    },
  }
  assert({ actual, expected })
}
