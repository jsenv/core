import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  readFile,
  resolveUrl,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import { browserImportSystemJsBuild } from "@jsenv/core/test/browserImportSystemJsBuild.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}script_module.html`]: "./main.html",
}
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const { buildMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
  minify: true,
})
const jsBuildRelativeUrl = buildMappings[`${testDirectoryRelativeUrl}main.js`]

// sourcemap looks good
{
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

// execution works
{
  const mainJsRelativeUrl = buildMappings[`${testDirectoryRelativeUrl}main.js`]
  const { namespace } = await browserImportSystemJsBuild({
    ...IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    mainRelativeUrl: `./${mainJsRelativeUrl}`,
    // debug: true,
  })

  const actual = namespace
  const expected = { value: 42 }
  assert({ actual, expected })
}
