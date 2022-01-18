import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  readFile,
  resolveUrl,
} from "@jsenv/filesystem"

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
const { buildMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  // filesystemCache: true,
  buildDirectoryRelativeUrl,
  entryPoints: {
    [`./${testDirectoryRelativeUrl}main.html`]: "main.html",
  },
})
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const jsBuildRelativeUrl =
  buildMappings[`${testDirectoryRelativeUrl}importing_preact.js`]
const sourcemapBuildRelativeUrl = `${jsBuildRelativeUrl}.map`

// sourcemap
{
  const sourcemapBuildUrl = resolveUrl(
    sourcemapBuildRelativeUrl,
    buildDirectoryUrl,
  )
  const buildRelativeParts = urlToRelativeUrl(
    jsenvCoreDirectoryUrl,
    buildDirectoryUrl,
  )
  const sourcemapString = await readFile(sourcemapBuildUrl)
  const sourcemap = JSON.parse(sourcemapString)
  const actual = {
    file: sourcemap.file,
    sources: sourcemap.sources,
  }
  const expected = {
    file: "importing_preact.js",
    sources: [
      `${buildRelativeParts}helpers/babel/typeof/typeof.js`,
      `${buildRelativeParts}node_modules/preact/src/util.js`,
      `${buildRelativeParts}node_modules/preact/src/options.js`,
      `${buildRelativeParts}node_modules/preact/src/create-element.js`,
      `${buildRelativeParts}node_modules/preact/src/constants.js`,
      `${buildRelativeParts}node_modules/preact/src/diff/catch-error.js`,
      `${buildRelativeParts}node_modules/preact/src/component.js`,
      "../../importing_preact.js",
    ],
  }
  assert({ actual, expected })
}

{
  const { returnValue } = await executeInBrowser({
    directoryUrl: new URL("./", import.meta.url),
    htmlFileRelativeUrl: "./dist/systemjs/main.html",
    /* eslint-disable no-undef */
    pageFunction: (jsBuildRelativeUrl) => {
      return window.System.import(`./${jsBuildRelativeUrl}`)
    },
    /* eslint-enable no-undef */
    pageArguments: [jsBuildRelativeUrl],
  })
  const actual = returnValue
  const expected = {
    default: "function",
  }
  assert({ actual, expected })
}
