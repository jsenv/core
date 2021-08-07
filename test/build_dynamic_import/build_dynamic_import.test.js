import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, urlToBasename } from "@jsenv/util"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  BROWSER_IMPORT_BUILD_TEST_PARAMS,
  NODE_IMPORT_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { browserImportEsModuleBuild } from "@jsenv/core/test/browserImportEsModuleBuild.js"
import { nodeImportEsModuleBuild } from "@jsenv/core/test/nodeImportEsModuleBuild.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${testDirectoryname}.js`]: "./main.js",
}

await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
  // logLevel: "debug",
})

{
  const { namespace } = await browserImportEsModuleBuild({
    ...BROWSER_IMPORT_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    htmlFileRelativeUrl: "./main.html",
    jsFileRelativeUrl: "./dist/esmodule/main.js",
    // debug: true,
  })

  const actual = namespace
  const expected = { value: 42 }
  assert({ actual, expected })
}

{
  const { namespace } = await nodeImportEsModuleBuild({
    ...NODE_IMPORT_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
  })

  const actual = namespace
  const expected = { value: 42 }
  assert({ actual, expected })
}
