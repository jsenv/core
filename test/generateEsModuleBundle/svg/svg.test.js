import { SourceMap } from "module"
import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, readFile } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { generateEsModuleBundle } from "../../../index.js"
import {
  GENERATE_ESMODULE_BUNDLE_TEST_PARAMS,
  NODE_IMPORT_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"
import { nodeImportBundle } from "../nodeImportBundle.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const bundleDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const mainFilename = `${testDirectoryname}.js`

await generateEsModuleBundle({
  ...GENERATE_ESMODULE_BUNDLE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  bundleDirectoryRelativeUrl,
  entryPointMap: {
    main: `./${testDirectoryRelativeUrl}${mainFilename}`,
  },
})

// {
//   const { value: actual } = await browserImportBundle({
//     ...BROWSER_IMPORT_BUNDLE_TEST_PARAMS,
//     bundleDirectoryRelativeUrl,
//   })
//   const expected = 42
//   assert({ actual, expected })
// }

// node 13.8 test
if (SourceMap) {
  const { value: actual } = await nodeImportBundle({
    ...NODE_IMPORT_BUNDLE_TEST_PARAMS,
    bundleDirectoryRelativeUrl,
  })
  const expected = await readFile(resolveUrl("./icon.svg", import.meta.url))
  assert({ actual, expected })
}
