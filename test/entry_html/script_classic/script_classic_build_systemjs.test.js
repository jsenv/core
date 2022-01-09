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
  GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import { browserImportEsModuleBuild } from "@jsenv/core/test/browserImportEsModuleBuild.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const test = async (params) => {
  const { buildMappings } = await buildProject({
    ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
    // logLevel: "debug",
    jsenvDirectoryRelativeUrl: `${testDirectoryRelativeUrl}.jsenv/`,
    buildDirectoryRelativeUrl,
    entryPoints: {
      [`./${testDirectoryRelativeUrl}script_classic.html`]: "main.html",
    },
    ...params,
  })
  return { buildMappings }
}

const { buildMappings } = await test()
const jsBuildRelativeUrl = buildMappings[`${testDirectoryRelativeUrl}main.js`]
const sourcemapBuildRelativeUrl =
  buildMappings[`${testDirectoryRelativeUrl}main.js.map`]
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
    sources: ["../../../main.js"],
    names: assert.any(Array),
    mappings: assert.any(String),
    sourcesContent: [await readFile(new URL("./main.js", import.meta.url))],
    file: "main_70c5b913.js",
  }
  assert({ actual, expected })
}

// execution works
{
  const result = await browserImportEsModuleBuild({
    ...IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
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
