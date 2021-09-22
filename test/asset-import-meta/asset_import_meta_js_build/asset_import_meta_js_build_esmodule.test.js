import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, urlToBasename } from "@jsenv/filesystem"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

import { buildProject } from "@jsenv/core"
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
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const mainFilename = `${testDirectoryname}.html`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.html",
}
const { buildMappings } = await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
})
const indexFileBuildRelativeUrl =
  buildMappings[`${testDirectoryRelativeUrl}index.js`]

{
  const { namespace, serverOrigin } = await browserImportEsModuleBuild({
    ...BROWSER_IMPORT_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    jsFileRelativeUrl: `./${indexFileBuildRelativeUrl}`,
    // debug: true,
  })
  const fileBuildRelativeUrl =
    buildMappings[`${testDirectoryRelativeUrl}file.js`]
  const actual = namespace
  const expected = {
    jsUrl: String(
      new URL(`./dist/esmodule/${fileBuildRelativeUrl}`, serverOrigin),
    ),
  }
  assert({ actual, expected })
}
