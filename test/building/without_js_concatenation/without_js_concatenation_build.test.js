// see also https://github.com/rollup/rollup/issues/3882

import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  BROWSER_IMPORT_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { browserImportEsModuleBuild } from "@jsenv/core/test/browserImportEsModuleBuild.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const { buildMappings } = await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPoints: {
    [`./${testDirectoryRelativeUrl}without_js_concatenation.html`]: "main.html",
  },
  jsConcatenation: false,
  // logLevel: "debug",
})

{
  const actual = buildMappings
  const expected = {
    [`${testDirectoryRelativeUrl}file.js`]: "file_d4d10f0c.js",
    [`${testDirectoryRelativeUrl}main.js`]: "main_a10d6b06.js",
    [`${testDirectoryRelativeUrl}without_js_concatenation.html`]: "main.html",
  }
  assert({ actual, expected })
}

{
  const mainJsFileRelativeUrl =
    buildMappings[`${testDirectoryRelativeUrl}main.js`]
  const { namespace } = await browserImportEsModuleBuild({
    ...BROWSER_IMPORT_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    htmlFileRelativeUrl: "./dist/esmodule/main.html",
    jsFileRelativeUrl: `./${mainJsFileRelativeUrl}`,
    // debug: true,
  })

  const actual = namespace
  const expected = { default: 42 }
  assert({ actual, expected })
}
