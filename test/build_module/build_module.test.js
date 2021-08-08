import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl, urlToBasename } from "@jsenv/util"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  BROWSER_IMPORT_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { browserImportEsModuleBuild } from "@jsenv/core/test/browserImportEsModuleBuild.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${testDirectoryname}.html`]: "./main.html",
}

const { buildMappings } = await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
  // minify: true,
})

{
  const mainJsRelativeUrl = buildMappings[`${testDirectoryRelativeUrl}main.js`]
  const result = await browserImportEsModuleBuild({
    ...BROWSER_IMPORT_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    jsFileRelativeUrl: `./${mainJsRelativeUrl}`,
    // debug: true,
  })

  const actual = result.namespace
  const expected = {
    value: 42,
  }
  assert({ actual, expected })
}
