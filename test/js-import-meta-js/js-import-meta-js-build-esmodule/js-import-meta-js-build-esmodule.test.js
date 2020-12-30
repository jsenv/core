import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { buildProject } from "@jsenv/core"
import {
  GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  BROWSER_IMPORT_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { browserImportEsModuleBuild } from "@jsenv/core/test/browserImportEsModuleBuild.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const mainFilename = `${testDirectoryname}.js`

const { buildMappings } = await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.js",
  },
})

// assert build mappings does not contains dep.js
// -> js was handled like an asset (no parsing)
{
  const actual = Object.keys(buildMappings)
  const expected = [
    `${testDirectoryRelativeUrl}file.js`,
    `${testDirectoryRelativeUrl}file.js.map`,
    `${testDirectoryRelativeUrl}js-import-meta-js-build-esmodule.js`,
  ]
  assert({ actual, expected })
}

{
  const { namespace, serverOrigin } = await browserImportEsModuleBuild({
    ...BROWSER_IMPORT_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    // debug: true,
  })
  const fileBuildRelativeUrl = buildMappings[`${testDirectoryRelativeUrl}file.js`]
  const actual = namespace
  const expected = {
    jsUrl: String(new URL(`./dist/esmodule/${fileBuildRelativeUrl}`, serverOrigin)),
  }
  assert({ actual, expected })
}
