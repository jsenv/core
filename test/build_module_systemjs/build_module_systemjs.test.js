import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl, urlToBasename } from "@jsenv/util"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import { browserImportSystemJsBuild } from "@jsenv/core/test/browserImportSystemJsBuild.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${testDirectoryname}.html`]: "./main.html",
}

const { buildMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
  // minify: true,
})

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
