import { assert } from "@jsenv/assert"
import {
  readFile,
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { executeInBrowser } from "@jsenv/core/test/execute_in_browser.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const entryPoints = {
  [`./${testDirectoryRelativeUrl}script_module.html`]: "main.html",
}
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const test = async (params) => {
  const { buildMappings } = await buildProject({
    ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
    // logLevel: "debug",
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    entryPoints,
    ...params,
  })
  const jsBuildRelativeUrl = buildMappings[`${testDirectoryRelativeUrl}main.js`]
  return { jsBuildRelativeUrl }
}

const { jsBuildRelativeUrl } = await test()
const sourcemapBuildRelativeUrl = `${jsBuildRelativeUrl}.map`
const sourcemapBuildUrl = resolveUrl(
  sourcemapBuildRelativeUrl,
  buildDirectoryUrl,
)
const sourcemap = await readFile(sourcemapBuildUrl, { as: "json" })

// sourcemap looks good
{
  const actual = sourcemap
  const expected = {
    version: 3,
    file: "main.js",
    sources: ["../../main.js"],
    sourcesContent: [await readFile(new URL("./main.js", import.meta.url))],
    names: assert.any(Array),
    mappings: assert.any(String),
  }
  assert({ actual, expected })
}

// execution works
{
  const { returnValue } = await executeInBrowser({
    directoryUrl: new URL("./", import.meta.url),
    htmlFileRelativeUrl: "./dist/esmodule/main.html",
    /* eslint-disable no-undef */
    pageFunction: async (jsBuildRelativeUrl) => {
      const namespace = await import(jsBuildRelativeUrl)
      return namespace
    },
    /* eslint-enable no-undef */
    pageArguments: [`./${jsBuildRelativeUrl}`],
  })
  const actual = returnValue
  const expected = {
    value: 42,
  }
  assert({ actual, expected })
}

// retry sourcemap with minification
{
  const { jsBuildRelativeUrl } = await test({ minify: true })
  const sourcemapBuildRelativeUrl = `${jsBuildRelativeUrl}.map`
  const sourcemapBuildUrl = resolveUrl(
    sourcemapBuildRelativeUrl,
    buildDirectoryUrl,
  )
  const sourcemap = await readFile(sourcemapBuildUrl, { as: "json" })

  const actual = sourcemap
  const expected = {
    version: 3,
    file: "main.js",
    sources: ["../../main.js"],
    sourcesContent: [await readFile(new URL("./main.js", import.meta.url))],
    names: assert.any(Array),
    mappings: assert.any(String),
  }
  assert({ actual, expected })
}
