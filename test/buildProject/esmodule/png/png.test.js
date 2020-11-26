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

await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.js",
  },
})

await assertFilePresence(resolveUrl("./dist/esmodule/assets/jsenv-25e95a00.png", import.meta.url))

{
  const { value: actual, serverOrigin } = await browserImportBuild({
    ...BROWSER_IMPORT_BUILD_TEST_PARAMS,
    buildDirectoryRelativeUrl,
  })
  const expected = new URL("./assets/jsenv-25e95a00.png", serverOrigin).href
  assert({ actual, expected })
}

// node 13.8 test
if (SourceMap) {
  const { value: actual } = await nodeImportBuild({
    ...NODE_IMPORT_BUILD_TEST_PARAMS,
    buildDirectoryRelativeUrl,
  })
  const expected = new URL("./dist/esmodule/assets/jsenv-25e95a00.png", import.meta.url).href
  assert({ actual, expected })
}
