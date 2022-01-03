import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import { browserImportSystemJsBuild } from "@jsenv/core/test/browserImportSystemJsBuild.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `import_meta_url_pattern.html`

const { buildMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPoints: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "main.html",
  },
})

const depFileBuildRelativeUrl =
  buildMappings[`${testDirectoryRelativeUrl}dep.js`]
const fileBuildRelativeUrl = buildMappings[`${testDirectoryRelativeUrl}file.js`]

// assert build mappings does not contains dep.js (concatenation)
{
  const actual = Object.keys(buildMappings).includes(depFileBuildRelativeUrl)
  const expected = false
  assert({ actual, expected })
}

{
  const { namespace, serverOrigin } = await browserImportSystemJsBuild({
    ...IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    codeToRunInBrowser: `window.namespace`,
    // debug: true,
  })

  const actual = namespace
  const expected = {
    jsUrlInstanceOfUrl: true,
    jsUrlString: String(
      new URL(`./dist/systemjs/${fileBuildRelativeUrl}`, serverOrigin),
    ),
  }
  assert({ actual, expected })
}
