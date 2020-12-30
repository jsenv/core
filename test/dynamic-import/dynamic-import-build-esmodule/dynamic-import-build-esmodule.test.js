import { SourceMap } from "module"
import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { buildProject } from "@jsenv/core"
import {
  GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  BROWSER_IMPORT_BUILD_TEST_PARAMS,
  NODE_IMPORT_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { browserImportEsModuleBuild } from "@jsenv/core/test/browserImportEsModuleBuild.js"
import { nodeImportEsModuleBuild } from "@jsenv/core/test/nodeImportEsModuleBuild.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const mainFilename = `${testDirectoryname}.js`

await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.js",
  },
})
{
  const { namespace } = await browserImportEsModuleBuild({
    ...BROWSER_IMPORT_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    // debug: true,
  })
  const actual = namespace
  const expected = { value: 42 }
  assert({ actual, expected })
}
// SourceMap added in 13.7, used to test only if we got dynamic import
if (SourceMap) {
  const { namespace } = await nodeImportEsModuleBuild({
    ...NODE_IMPORT_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
  })
  const actual = namespace
  const expected = { value: 42 }
  assert({ actual, expected })
}
