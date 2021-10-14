import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  urlToFileSystemPath,
  readFile,
} from "@jsenv/filesystem"

import { buildProject, jsenvServiceWorkerFinalizer } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { require } from "@jsenv/core/src/internal/require.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"

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
const test = async (params) => {
  const { buildMappings } = await buildProject({
    ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
    // logLevel: "info",
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    entryPointMap,
    serviceWorkers: {
      [`${testDirectoryRelativeUrl}sw.js`]: "sw.cjs",
    },
    serviceWorkerFinalizer: jsenvServiceWorkerFinalizer,
    ...params,
  })
  return { buildMappings }
}

// without minification
{
  const { buildMappings } = await test({ minify: false })

  const sourcemapBuildRelativeUrl =
    buildMappings[`${testDirectoryRelativeUrl}main.js.map`]
  const sourcemapBuildUrl = resolveUrl(
    sourcemapBuildRelativeUrl,
    buildDirectoryUrl,
  )
  const sourcemap = await readFile(sourcemapBuildUrl, { as: "json" })
  const actual = sourcemap
  const expected = actual
  assert({ actual, expected })
}

// with minification
{
  const { buildMappings } = await test({ minify: true })

  const sourcemapBuildRelativeUrl =
    buildMappings[`${testDirectoryRelativeUrl}main.js.map`]
  const sourcemapBuildUrl = resolveUrl(
    sourcemapBuildRelativeUrl,
    buildDirectoryUrl,
  )
  const sourcemap = await readFile(sourcemapBuildUrl, { as: "json" })
  const actual = sourcemap
  const expected = actual
  assert({ actual, expected })

  if (process.platform !== "win32") {
    // hash differ because of line endings

    const serviceWorkerBuildUrl = resolveUrl("sw.cjs", buildDirectoryUrl)
    global.self = {}
    // eslint-disable-next-line import/no-dynamic-require
    require(urlToFileSystemPath(serviceWorkerBuildUrl))
    const actual = global.self
    const expected = {
      generatedUrlsConfig: {
        "assets/style-b126d686.css": { versioned: true },
        "main.html": {
          versioned: false,
          // because when html file is modified, it's url is not
          // if you update only the html file, browser won't update the service worker.
          // To ensure worker is still updated, jsenv adds a jsenvStaticUrlsHash
          // to include a hash for the html file.
          // -> when html file changes -> hash changes -> worker updates
          version: "01aecf63",
        },
      },
    }
    assert({ actual, expected })
  }
}
