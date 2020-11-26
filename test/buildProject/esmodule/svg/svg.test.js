import { SourceMap } from "module"
import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, assertFilePresence } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { buildProject } from "@jsenv/core/index.js"
import {
  GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  BROWSER_IMPORT_BUILD_TEST_PARAMS,
  NODE_IMPORT_BUILD_TEST_PARAMS,
} from "../TEST_PARAMS.js"
import { browserImportBuild } from "../browserImportBuild.js"
import { nodeImportBuild } from "../nodeImportBuild.js"

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
  const { value: actual, serverOrigin } = await browserImportBuild({
    ...BROWSER_IMPORT_BUILD_TEST_PARAMS,
    buildDirectoryRelativeUrl,
  })
  const expected = new URL(iconBuildRelativeUrl, serverOrigin).href
  assert({ actual, expected })
}

// node 13.8 test
if (SourceMap) {
  const { value: actual } = await nodeImportBuild({
    ...NODE_IMPORT_BUILD_TEST_PARAMS,
    buildDirectoryRelativeUrl,
  })
  const expected = new URL(`./dist/esmodule/${iconBuildRelativeUrl}`, import.meta.url).href
  assert({ actual, expected })
}
