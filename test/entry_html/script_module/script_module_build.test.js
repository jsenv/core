import { assert } from "@jsenv/assert"
import {
  readFile,
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
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
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}script_module.html`]: "./main.html",
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
    entryPointMap,
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
  const result = await browserImportEsModuleBuild({
    ...BROWSER_IMPORT_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    jsFileRelativeUrl: `./${jsBuildRelativeUrl}`,
    // debug: true,
  })

  const actual = result.namespace
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
