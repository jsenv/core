import { SourceMap } from "module"
import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, assertFilePresence } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { generateBundle } from "@jsenv/core/index.js"
import {
  GENERATE_ESMODULE_BUNDLE_TEST_PARAMS,
  BROWSER_IMPORT_BUNDLE_TEST_PARAMS,
  NODE_IMPORT_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"
import { browserImportBundle } from "../browserImportBundle.js"
import { nodeImportBundle } from "../nodeImportBundle.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const mainFilename = `${testDirectoryname}.js`

const { bundleMappings } = await generateBundle({
  ...GENERATE_ESMODULE_BUNDLE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.js",
  },
})

const iconBundleRelativeUrl = bundleMappings[`${testDirectoryRelativeUrl}icon.svg`]
const iconBundleUrl = resolveUrl(`./dist/esmodule/${iconBundleRelativeUrl}`, import.meta.url)

await assertFilePresence(iconBundleUrl)

{
  const { value: actual, serverOrigin } = await browserImportBundle({
    ...BROWSER_IMPORT_BUNDLE_TEST_PARAMS,
    buildDirectoryRelativeUrl,
  })
  const expected = new URL(iconBundleRelativeUrl, serverOrigin).href
  assert({ actual, expected })
}

// node 13.8 test
if (SourceMap) {
  const { value: actual } = await nodeImportBundle({
    ...NODE_IMPORT_BUNDLE_TEST_PARAMS,
    buildDirectoryRelativeUrl,
  })
  const expected = new URL(`./dist/esmodule/${iconBundleRelativeUrl}`, import.meta.url).href
  assert({ actual, expected })
}
