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
const mainFilename = `import_meta_url_pattern.html`
const { buildMappings } = await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPoints: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "main.html",
  },
})

const { namespace, serverOrigin } = await browserImportEsModuleBuild({
  ...BROWSER_IMPORT_BUILD_TEST_PARAMS,
  testDirectoryRelativeUrl,
  codeToRunInBrowser: `window.namespace`,
  // debug: true,
})
const fileBuildRelativeUrl = buildMappings[`${testDirectoryRelativeUrl}file.js`]

const actual = namespace
const expected = {
  jsUrlInstanceOfUrl: true,
  jsUrlString: String(
    new URL(`./dist/esmodule/${fileBuildRelativeUrl}`, serverOrigin),
  ),
}
assert({ actual, expected })
