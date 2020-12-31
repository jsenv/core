import { SourceMap } from "module"
import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, assertFilePresence } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  BROWSER_IMPORT_BUILD_TEST_PARAMS,
  NODE_IMPORT_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { browserImportEsModuleBuild } from "@jsenv/core/test/browserImportEsModuleBuild.js"
import { nodeImportEsModuleBuild } from "@jsenv/core/test/nodeImportEsModuleBuild.js"
import { buildProject } from "@jsenv/core"

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

const iconBuildRelativeUrl = buildMappings[`${testDirectoryRelativeUrl}icon.svg`]
const iconBuildUrl = resolveUrl(`./dist/esmodule/${iconBuildRelativeUrl}`, import.meta.url)

await assertFilePresence(iconBuildUrl)

{
  const { namespace, serverOrigin } = await browserImportEsModuleBuild({
    ...BROWSER_IMPORT_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
  })
  const actual = namespace
  const expected = {
    default: String(new URL(`./dist/esmodule/${iconBuildRelativeUrl}`, serverOrigin)),
  }
  assert({ actual, expected })
}

// node 13.8 test
if (SourceMap) {
  const { namespace } = await nodeImportEsModuleBuild({
    ...NODE_IMPORT_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
  })
  const actual = namespace
  const expected = {
    default: String(new URL(`./dist/esmodule/${iconBuildRelativeUrl}`, import.meta.url)),
  }
  assert({ actual, expected })
}
